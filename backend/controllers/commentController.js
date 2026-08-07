const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Vote = require('../models/Vote');
const Notification = require('../models/Notification');
const { updateKarma } = require('../services/karmaService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

const MAX_DEPTH = 8;

// ─── Helper: Sanitize Comment for Public Response ──────────────────────────────
const sanitizeComment = (comment, requestingUserId = null) => {
  const obj = comment.toObject ? comment.toObject() : { ...comment };

  const isOwner =
    requestingUserId &&
    obj.author &&
    obj.author._id &&
    obj.author._id.toString() === requestingUserId.toString();

  // Enforce pseudonymous public representation
  if (obj.author && typeof obj.author === 'object') {
    obj.author = {
      _id: obj.author._id,
      username: obj.author.username.startsWith('u/') ? obj.author.username : `u/${obj.author.username}`,
      avatar: obj.author.avatar || obj.author.profileImage || null,
      bio: obj.author.bio || '',
      karma: obj.author.karma || { post: 0, comment: 0, total: 0 },
    };
  } else {
    obj.author = { username: '[deleted]', avatar: null };
  }

  // Soft-deleted content placeholder
  if (obj.isDeleted) {
    obj.content = '[Comment deleted]';
    obj.author = { username: '[deleted]', avatar: null };
  }

  return {
    ...obj,
    isOwner: isOwner || false,
  };
};

// ─── Helper: Enrich comments with vote status for request user ──────────────────
const enrichCommentsWithVotes = async (comments, userId) => {
  if (!comments || comments.length === 0) return comments;
  const commentIds = comments.map((c) => c._id);

  const votesMap = new Map();

  if (userId) {
    const votes = await Vote.find({
      user: userId,
      targetType: 'comment',
      targetId: { $in: commentIds },
    }).lean();
    votes.forEach((v) => {
      votesMap.set(v.targetId.toString(), v.value);
    });
  }

  return comments.map((c) => {
    c.voteStatus = votesMap.get(c._id.toString()) || 0;
    return c;
  });
};

// ─── Create Top-Level Comment ──────────────────────────────────────────────────
const createComment = asyncHandler(async (req, res) => {
  const { postId, content } = req.body;
  const authorId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, 'Invalid postId');
  }

  const post = await Post.findById(postId);
  if (!post || post.status !== 'active') {
    throw new ApiError(404, 'Post not found');
  }

  // Create comment (Starts with 1 upvote from the author)
  const comment = await Comment.create({
    post: postId,
    author: authorId,
    content: content.trim(),
    parentComment: null,
    depth: 0,
    upvoteCount: 1,
    downvoteCount: 0,
    score: 1,
  });

  // Create vote record for the self-upvote
  await Vote.create({
    user: authorId,
    targetType: 'comment',
    targetId: comment._id,
    value: 1,
  });

  // Add 1 comment karma to the author
  await updateKarma(authorId, 'comment', 1);

  // Increment post commentCount atomically
  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

  // Trigger Notification to post owner (if not self-interaction)
  if (post.author.toString() !== authorId.toString()) {
    const formattedMessage = `u/${req.user.username} commented on your post.`;
    await Notification.create({
      recipient: post.author,
      actor: authorId,
      type: 'post_comment',
      post: post._id,
      comment: comment._id,
      message: formattedMessage,
    });
  }

  const populated = await Comment.findById(comment._id).populate('author', 'username avatar bio karma');
  const sanitized = sanitizeComment(populated, authorId);
  const [enriched] = await enrichCommentsWithVotes([sanitized], authorId);

  sendResponse(res, 201, 'Comment posted successfully', { comment: enriched });
});

// ─── Reply to Comment ─────────────────────────────────────────────────────────
const replyToComment = asyncHandler(async (req, res) => {
  const { id: parentCommentId } = req.params;
  const { content } = req.body;
  const authorId = req.user._id;

  const parentComment = await Comment.findById(parentCommentId);
  if (!parentComment || parentComment.status === 'removed') {
    throw new ApiError(404, 'Parent comment not found');
  }

  const newDepth = parentComment.depth + 1;
  if (newDepth > MAX_DEPTH) {
    throw new ApiError(400, `Maximum reply depth of ${MAX_DEPTH} reached`);
  }

  const post = await Post.findById(parentComment.post);
  if (!post || post.status !== 'active') {
    throw new ApiError(404, 'Post not found or no longer active');
  }

  // Create reply (Starts with 1 upvote from the author)
  const reply = await Comment.create({
    post: parentComment.post,
    author: authorId,
    parentComment: parentCommentId,
    depth: newDepth,
    content: content.trim(),
    upvoteCount: 1,
    downvoteCount: 0,
    score: 1,
  });

  // Create vote record for the self-upvote
  await Vote.create({
    user: authorId,
    targetType: 'comment',
    targetId: reply._id,
    value: 1,
  });

  // Add 1 comment karma to the author
  await updateKarma(authorId, 'comment', 1);

  // Increment counters atomically
  await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
  await Post.findByIdAndUpdate(parentComment.post, { $inc: { commentCount: 1 } });

  // Trigger Notification to parent comment owner (if not self-interaction)
  if (parentComment.author.toString() !== authorId.toString()) {
    const formattedMessage = `u/${req.user.username} replied to your comment.`;
    await Notification.create({
      recipient: parentComment.author,
      actor: authorId,
      type: 'comment_reply',
      post: parentComment.post,
      comment: reply._id,
      message: formattedMessage,
    });
  }

  const populated = await Comment.findById(reply._id).populate('author', 'username avatar bio karma');
  const sanitized = sanitizeComment(populated, authorId);
  const [enriched] = await enrichCommentsWithVotes([sanitized], authorId);

  sendResponse(res, 201, 'Reply posted successfully', { comment: enriched });
});

// ─── Get Post Comments (threaded) ─────────────────────────────────────────────
const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user ? req.user._id : null;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, 'Invalid postId');
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Fetch all comments in a single query
  const comments = await Comment.find({
    post: postId,
    status: { $ne: 'removed' },
  })
    .sort({ createdAt: 1 })
    .populate('author', 'username avatar bio karma')
    .lean();

  // Sanitize
  const sanitized = comments.map((c) => sanitizeComment(c, userId));

  // Enrich with user vote statuses
  const enriched = await enrichCommentsWithVotes(sanitized, userId);

  // Build tree structure in-memory
  const commentMap = {};
  enriched.forEach((c) => {
    commentMap[c._id.toString()] = { ...c, replies: [] };
  });

  const topLevel = [];
  enriched.forEach((c) => {
    if (c.parentComment) {
      const parent = commentMap[c.parentComment.toString()];
      if (parent) {
        parent.replies.push(commentMap[c._id.toString()]);
      }
    } else {
      topLevel.push(commentMap[c._id.toString()]);
    }
  });

  sendResponse(res, 200, 'Comments retrieved successfully', {
    comments: topLevel,
    total: comments.length,
  });
});

// ─── Edit Comment ─────────────────────────────────────────────────────────────
const updateComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  const comment = await Comment.findById(id);
  if (!comment || comment.status === 'removed') {
    throw new ApiError(404, 'Comment not found');
  }

  if (comment.author.toString() !== userId.toString()) {
    throw new ApiError(403, 'You are not authorized to edit this comment');
  }

  if (comment.isDeleted) {
    throw new ApiError(400, 'Cannot edit a deleted comment');
  }

  comment.content = content.trim();
  comment.edited = true;
  await comment.save();

  const populated = await Comment.findById(comment._id).populate('author', 'username avatar bio karma');
  const sanitized = sanitizeComment(populated, userId);
  const [enriched] = await enrichCommentsWithVotes([sanitized], userId);

  sendResponse(res, 200, 'Comment updated successfully', { comment: enriched });
});

// ─── Delete Comment ───────────────────────────────────────────────────────────
const deleteComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const comment = await Comment.findById(id);
  if (!comment || comment.status === 'removed') {
    throw new ApiError(404, 'Comment not found');
  }

  if (comment.author.toString() !== userId.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this comment');
  }

  // Check if comment has active replies
  const hasReplies = await Comment.exists({
    parentComment: comment._id,
    status: { $ne: 'removed' },
  });

  if (hasReplies) {
    // Soft delete to preserve nested thread path structure
    comment.isDeleted = true;
    comment.content = '[Comment deleted]';
    await comment.save();
  } else {
    // Hard delete
    await Comment.deleteOne({ _id: id });

    // Decrement parent replyCount atomically
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
      const parent = await Comment.findById(comment.parentComment);
      if (parent && parent.replyCount < 0) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $set: { replyCount: 0 } });
      }
    }

    // Decrement post commentCount atomically
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
    const post = await Post.findById(comment.post);
    if (post && post.commentCount < 0) {
      await Post.findByIdAndUpdate(comment.post, { $set: { commentCount: 0 } });
    }
  }

  // Cleanup votes on hard delete
  if (!hasReplies) {
    await Vote.deleteMany({ targetType: 'comment', targetId: id });
  }

  sendResponse(res, 200, 'Comment deleted successfully');
});

module.exports = {
  createComment,
  getPostComments,
  replyToComment,
  updateComment,
  deleteComment,
};
