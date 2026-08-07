const Vote = require('../models/Vote');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { updateKarma } = require('../services/karmaService');
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

  if (oldValue === value) {
    // Undo vote if user clicks the same vote again
    newValue = 0;
    await Vote.deleteOne({ _id: existingVote._id });
  } else if (existingVote) {
    // Switch vote direction (1 -> -1 or -1 -> 1)
    existingVote.value = value;
    await existingVote.save();
  } else {
    // Create new vote
    await Vote.create({
      user: userId,
      targetType: 'post',
      targetId: postId,
      value,
    });
  }

  // Calculate vote count differences
  const upvoteDiff = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0);
  const downvoteDiff = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0);
  const scoreDiff = newValue - oldValue;

  // Update post counts atomically
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    {
      $inc: {
        upvoteCount: upvoteDiff,
        downvoteCount: downvoteDiff,
        score: scoreDiff,
      },
    },
    { new: true }
  );

  // Safety checks to prevent negative counts
  if (updatedPost.upvoteCount < 0 || updatedPost.downvoteCount < 0) {
    await Post.findByIdAndUpdate(postId, {
      $set: {
        upvoteCount: Math.max(0, updatedPost.upvoteCount),
        downvoteCount: Math.max(0, updatedPost.downvoteCount),
      },
    });
    updatedPost.upvoteCount = Math.max(0, updatedPost.upvoteCount);
    updatedPost.downvoteCount = Math.max(0, updatedPost.downvoteCount);
  }
  const { calculateHotRank } = require('../services/rankingService');
  updatedPost.score = updatedPost.upvoteCount - updatedPost.downvoteCount;
  updatedPost.hotRank = calculateHotRank(updatedPost.upvoteCount, updatedPost.downvoteCount, updatedPost.createdAt);
  await updatedPost.save();

  // Sync author karma (score change equals karma change)
  if (post.author.toString() !== userId.toString()) {
    await updateKarma(post.author, 'post', scoreDiff);
  }

  // Trigger Notification for upvote (and not self-interaction)
  if (newValue === 1 && post.author.toString() !== userId.toString() && oldValue !== 1) {
    const formattedMessage = `u/${req.user.username} upvoted your post.`;
    await Notification.create({
      recipient: post.author,
      actor: userId,
      type: 'post_vote',
      post: post._id,
      message: formattedMessage,
    });
  }

  sendResponse(res, 200, newValue === 0 ? 'Vote removed' : newValue === 1 ? 'Post upvoted' : 'Post downvoted', {
    score: updatedPost.score,
    voteStatus: newValue,
  });
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

  if (oldValue === value) {
    newValue = 0;
    await Vote.deleteOne({ _id: existingVote._id });
  } else if (existingVote) {
    existingVote.value = value;
    await existingVote.save();
  } else {
    await Vote.create({
      user: userId,
      targetType: 'comment',
      targetId: commentId,
      value,
    });
  }

  const upvoteDiff = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0);
  const downvoteDiff = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0);
  const scoreDiff = newValue - oldValue;

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $inc: {
        upvoteCount: upvoteDiff,
        downvoteCount: downvoteDiff,
        score: scoreDiff,
      },
    },
    { new: true }
  );

  // Safety checks
  if (updatedComment.upvoteCount < 0 || updatedComment.downvoteCount < 0) {
    await Comment.findByIdAndUpdate(commentId, {
      $set: {
        upvoteCount: Math.max(0, updatedComment.upvoteCount),
        downvoteCount: Math.max(0, updatedComment.downvoteCount),
      },
    });
    updatedComment.upvoteCount = Math.max(0, updatedComment.upvoteCount);
    updatedComment.downvoteCount = Math.max(0, updatedComment.downvoteCount);
  }
  updatedComment.score = updatedComment.upvoteCount - updatedComment.downvoteCount;
  await updatedComment.save();

  // Sync author karma
  if (comment.author.toString() !== userId.toString()) {
    await updateKarma(comment.author, 'comment', scoreDiff);
  }

  // Trigger Notification
  if (newValue === 1 && comment.author.toString() !== userId.toString() && oldValue !== 1) {
    const formattedMessage = `u/${req.user.username} upvoted your comment.`;
    await Notification.create({
      recipient: comment.author,
      actor: userId,
      type: 'comment_vote',
      post: comment.post,
      comment: comment._id,
      message: formattedMessage,
    });
  }

  sendResponse(res, 200, newValue === 0 ? 'Vote removed' : newValue === 1 ? 'Comment upvoted' : 'Comment downvoted', {
    score: updatedComment.score,
    voteStatus: newValue,
  });
});

module.exports = { votePost, voteComment };
