const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Community = require('../models/Community');
const User = require('../models/User');
const Message = require('../models/Message');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const mongoose = require('mongoose');

const VALID_REASONS = ['spam', 'harassment', 'hate', 'misinformation', 'inappropriate', 'privacy', 'other'];
const VALID_TARGET_TYPES = ['post', 'comment', 'community', 'user', 'message'];

// ─── Submit Report (students) ─────────────────────────────────────────────────
const submitReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason, description } = req.body;
  const reporterId = req.user._id;

  // Validate targetType
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    throw new ApiError(
      400,
      `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}`
    );
  }

  // Validate targetId
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new ApiError(400, 'Invalid targetId');
  }

  // Validate reason
  if (!VALID_REASONS.includes(reason)) {
    throw new ApiError(400, `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}`);
  }

  // Verify target exists and get community if applicable
  let target;
  let communityId = null;

  if (targetType === 'post') {
    target = await Post.findById(targetId);
    if (!target || target.status === 'removed') {
      throw new ApiError(404, 'Post not found');
    }
    communityId = target.community;
  } else if (targetType === 'comment') {
    target = await Comment.findById(targetId);
    if (!target || target.status === 'removed') {
      throw new ApiError(404, 'Comment not found');
    }
    // Fetch post to get the community ID
    const post = await Post.findById(target.post);
    if (post) communityId = post.community;
  } else if (targetType === 'community') {
    target = await Community.findById(targetId);
    if (!target) {
      throw new ApiError(404, 'Community not found');
    }
    communityId = target._id;
  } else if (targetType === 'user') {
    target = await User.findById(targetId);
    if (!target) {
      throw new ApiError(404, 'User not found');
    }
  } else if (targetType === 'message') {
    target = await Message.findById(targetId);
    if (!target) {
      throw new ApiError(404, 'Message not found');
    }
  }

  // Prevent duplicate active reports from the same user on the same content
  const existingReport = await Report.findOne({
    reporter: reporterId,
    targetType,
    targetId,
    status: 'pending',
  });

  if (existingReport) {
    throw new ApiError(409, 'You have already submitted a pending report for this content');
  }

  const report = await Report.create({
    reporter: reporterId,
    targetType,
    targetId,
    community: communityId,
    reason,
    description: description?.trim() || '',
  });

  sendResponse(res, 201, 'Report submitted successfully. Thank you for keeping UniConnect safe.', {
    report: {
      _id: report._id,
      targetType: report.targetType,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    },
  });
});

module.exports = { submitReport };
