const Vote = require('../models/Vote');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { updateKarma, queueDelayedKarma } = require('../services/karmaService');
const { calculateHotRank } = require('../services/rankingService');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');

// ─── Vote on Post ─────────────────────────────────────────────────────────────
const votePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { value } = req.body; // must be 1 or -1
  const userId = req.user._id;

  if (value !== 1 && value !== -1) {
    throw new ApiError(400, 'Vote value must be 1 (upvote) or -1 (downvote)');
  }

  const post = await Post.findById(postId);
  if (!post || post.status === 'removed') {
    throw new ApiError(404, 'Post not found');
  }

  const existingVote = await Vote.findOne({
    user: userId,
    targetType: 'post',
    targetId: postId,
  });

  const oldValue = existingVote ? existingVote.value : 0;
  let newValue = value;
  let upvoteDiff = 0;
  let downvoteDiff = 0;
  let scoreDiff = 0;

  if (oldValue === value) {
    // Undo vote if user clicks the same vote again
    newValue = 0;
    await Vote.deleteOne({ _id: existingVote._id });
    upvoteDiff = oldValue === 1 ? -1 : 0;
    downvoteDiff = oldValue === -1 ? -1 : 0;
    scoreDiff = -oldValue;
  } else if (existingVote) {
    // Switch vote direction (1 -> -1 or -1 -> 1)
    await Vote.updateOne({ _id: existingVote._id }, { $set: { value } });
    upvoteDiff = value === 1 ? 1 : -1;
    downvoteDiff = value === -1 ? 1 : -1;
    scoreDiff = value - oldValue; // +2 or -2
  } else {
    // Create new vote
    try {
      await Vote.create({
        user: userId,
        targetType: 'post',
        targetId: postId,
        value,
      });
      upvoteDiff = value === 1 ? 1 : 0;
      downvoteDiff = value === -1 ? 1 : 0;
      scoreDiff = value;
    } catch (err) {
      if (err.code === 11000) {
        // Race condition: concurrent vote already registered
        const currentPost = await Post.findById(postId);
        return sendResponse(res, 200, 'Vote recorded', {
          score: currentPost.score,
          voteStatus: value,
        });
      }
      throw err;
    }
  }

  // Atomically update post counts
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    {
      $inc: {
        upvoteCount: upvoteDiff,
        downvoteCount: downvoteDiff,
        score: scoreDiff,
      },
    },
    { returnDocument: 'after' }
  );

  // Calculate hot rank without overwriting atomic counts
  const safeUpvotes = Math.max(0, updatedPost.upvoteCount);
  const safeDownvotes = Math.max(0, updatedPost.downvoteCount);
  const hotRank = calculateHotRank(
    safeUpvotes,
    safeDownvotes,
    updatedPost.commentCount || 0,
    updatedPost.createdAt
  );

  // Update hotRank atomically (do not touch counts or score)
  await Post.updateOne({ _id: postId }, { $set: { hotRank } });

  // Sync author karma (score change equals karma change; delayed for anonymous)
  if (post.author.toString() !== userId.toString()) {
    if (post.isAnonymous) {
      queueDelayedKarma(post.author, 'post', scoreDiff);
    } else {
      await updateKarma(post.author, 'post', scoreDiff);
    }
  }

  // Trigger Notification for upvote (and not self-interaction)
  if (newValue === 1 && post.author.toString() !== userId.toString() && oldValue !== 1) {
    const formattedMessage = 'Someone upvoted your post.';
    await Notification.create({
      recipient: post.author,
      actor: null,
      type: 'post_vote',
      post: post._id,
      message: formattedMessage,
    }).catch((err) => console.error('[Notification] Failed:', err.message));
  }

  sendResponse(
    res,
    200,
    newValue === 0
      ? 'Vote removed'
      : newValue === 1
      ? 'Post upvoted'
      : 'Post downvoted',
    {
      score: updatedPost.score,
      voteStatus: newValue,
    }
  );
});

// ─── Vote on Comment ──────────────────────────────────────────────────────────
const voteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { value } = req.body;
  const userId = req.user._id;

  if (value !== 1 && value !== -1) {
    throw new ApiError(400, 'Vote value must be 1 (upvote) or -1 (downvote)');
  }

  const comment = await Comment.findById(commentId);
  if (!comment || comment.status === 'removed') {
    throw new ApiError(404, 'Comment not found');
  }

  const existingVote = await Vote.findOne({
    user: userId,
    targetType: 'comment',
    targetId: commentId,
  });

  const oldValue = existingVote ? existingVote.value : 0;
  let newValue = value;
  let upvoteDiff = 0;
  let downvoteDiff = 0;
  let scoreDiff = 0;

  if (oldValue === value) {
    newValue = 0;
    await Vote.deleteOne({ _id: existingVote._id });
    upvoteDiff = oldValue === 1 ? -1 : 0;
    downvoteDiff = oldValue === -1 ? -1 : 0;
    scoreDiff = -oldValue;
  } else if (existingVote) {
    await Vote.updateOne({ _id: existingVote._id }, { $set: { value } });
    upvoteDiff = value === 1 ? 1 : -1;
    downvoteDiff = value === -1 ? 1 : -1;
    scoreDiff = value - oldValue;
  } else {
    try {
      await Vote.create({
        user: userId,
        targetType: 'comment',
        targetId: commentId,
        value,
      });
      upvoteDiff = value === 1 ? 1 : 0;
      downvoteDiff = value === -1 ? 1 : 0;
      scoreDiff = value;
    } catch (err) {
      if (err.code === 11000) {
        const currentComment = await Comment.findById(commentId);
        return sendResponse(res, 200, 'Vote recorded', {
          score: currentComment.score,
          voteStatus: value,
        });
      }
      throw err;
    }
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $inc: {
        upvoteCount: upvoteDiff,
        downvoteCount: downvoteDiff,
        score: scoreDiff,
      },
    },
    { returnDocument: 'after' }
  );

  // Sync author karma (delayed for anonymous comments)
  if (comment.author.toString() !== userId.toString()) {
    if (comment.isAnonymous) {
      queueDelayedKarma(comment.author, 'comment', scoreDiff);
    } else {
      await updateKarma(comment.author, 'comment', scoreDiff);
    }
  }

  // Trigger Notification
  if (newValue === 1 && comment.author.toString() !== userId.toString() && oldValue !== 1) {
    const formattedMessage = 'Someone upvoted your comment.';
    await Notification.create({
      recipient: comment.author,
      actor: null,
      type: 'comment_vote',
      post: comment.post,
      comment: comment._id,
      message: formattedMessage,
    }).catch((err) => console.error('[Notification] Failed:', err.message));
  }

  sendResponse(
    res,
    200,
    newValue === 0
      ? 'Vote removed'
      : newValue === 1
      ? 'Comment upvoted'
      : 'Comment downvoted',
    {
      score: updatedComment.score,
      voteStatus: newValue,
    }
  );
});

module.exports = { votePost, voteComment };
