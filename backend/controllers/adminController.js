const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

// ─── Admin Dashboard Stats ────────────────────────────────────────────────────
const getStats = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Run all count queries in parallel for efficiency
  const [
    totalUsers,
    verifiedUsers,
    totalPosts,
    totalComments,
    totalVotes,
    totalSavedPosts,
    totalReports,
    pendingReports,
    postsToday,
    commentsToday,
    usersJoinedToday,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ verified: true }),
    Post.countDocuments({ status: { $ne: 'removed' } }),
    Comment.countDocuments({ status: { $ne: 'removed' } }),
    Vote.countDocuments(),
    SavedPost.countDocuments(),
    Report.countDocuments(),
    Report.countDocuments({ status: 'pending' }),
    Post.countDocuments({ createdAt: { $gte: todayStart } }),
    Comment.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
  ]);

  sendResponse(res, 200, 'Admin statistics retrieved', {
    totalUsers,
    verifiedUsers,
    totalPosts,
    totalComments,
    totalVotes,
    totalSavedPosts,
    totalReports,
    pendingReports,
    postsToday,
    commentsToday,
    usersJoinedToday,
  });
});

// ─── Admin: Get Reports ───────────────────────────────────────────────────────
const getReports = asyncHandler(async (req, res) => {
  let { status, targetType, page = 1, limit = 20 } = req.query;

  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const filter = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;

  const total = await Report.countDocuments(filter);
  const reports = await Report.find(filter)
    .populate('reporter', 'username email') // Admin gets reporter info
    .populate('reviewedBy', 'username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  sendResponse(res, 200, 'Reports retrieved', {
    reports,
    pagination: { page, limit, total, pages, hasNext: page < pages, hasPrevious: page > 1 },
  });
});

// ─── Admin: Review Report ─────────────────────────────────────────────────────
const reviewReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, moderationNote } = req.body;

  const VALID_STATUSES = ['reviewed', 'dismissed', 'actioned'];
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const report = await Report.findById(id);
  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  report.status = status;
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  if (moderationNote !== undefined) report.moderationNote = moderationNote.trim();

  await report.save();

  sendResponse(res, 200, 'Report reviewed successfully', { report });
});

// ─── Admin: Moderate Post ─────────────────────────────────────────────────────
const moderatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ['active', 'hidden', 'removed'];
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  post.status = status;
  await post.save();

  sendResponse(res, 200, `Post status set to '${status}'`, {
    post: {
      _id: post._id,
      title: post.title,
      status: post.status,
      updatedAt: post.updatedAt,
    },
  });
});

// ─── Admin: Moderate Comment ──────────────────────────────────────────────────
const moderateComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ['active', 'hidden', 'removed'];
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const comment = await Comment.findById(id);
  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  if (status === 'removed') {
    const hasReplies = await Comment.exists({
      parentComment: comment._id,
      status: { $ne: 'removed' },
    });
    if (hasReplies) {
      comment.isDeleted = true;
      comment.content = '[Comment removed by moderator]';
    }
  }

  comment.status = status;
  await comment.save();

  sendResponse(res, 200, `Comment status set to '${status}'`, {
    comment: {
      _id: comment._id,
      status: comment.status,
      updatedAt: comment.updatedAt,
    },
  });
});

// ─── Admin: Get All Users ─────────────────────────────────────────────────────
const getUsers = asyncHandler(async (req, res) => {
  let { page = 1, limit = 20, verified, role } = req.query;

  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const filter = {};
  if (verified !== undefined) filter.verified = verified === 'true';
  if (role) filter.role = role;

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('username email role verified createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  // Format output usernames
  const formattedUsers = users.map((u) => {
    u.username = u.username.startsWith('u/') ? u.username : `u/${u.username}`;
    return u;
  });

  sendResponse(res, 200, 'Users retrieved', {
    users: formattedUsers,
    pagination: { page, limit, total, pages, hasNext: page < pages, hasPrevious: page > 1 },
  });
});

module.exports = {
  getStats,
  getReports,
  reviewReport,
  moderatePost,
  moderateComment,
  getUsers,
};
