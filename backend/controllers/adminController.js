const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const { decryptAuthor } = require('../utils/encryption');
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

// ─── Admin: Reveal Anonymous Author (Strictly Audited) ──────────────────────
const revealAuthor = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason } = req.body;
  const adminId = req.user._id;

  if (!targetType || !['post', 'comment'].includes(targetType)) {
    throw new ApiError(400, 'targetType must be either "post" or "comment"');
  }

  if (!targetId) {
    throw new ApiError(400, 'targetId is required');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new ApiError(400, 'A mandatory reason of at least 5 characters is required for deanonymization audit');
  }

  let targetDoc;
  if (targetType === 'post') {
    targetDoc = await Post.findById(targetId).select('+encryptedAuthor');
  } else {
    targetDoc = await Comment.findById(targetId).select('+encryptedAuthor');
  }

  if (!targetDoc) {
    throw new ApiError(404, `${targetType === 'post' ? 'Post' : 'Comment'} not found`);
  }

  if (!targetDoc.isAnonymous) {
    throw new ApiError(400, 'Target content is not anonymous');
  }

  // Author identity resolution (decrypted from encryptedAuthor if available, or direct author field)
  let authorId = targetDoc.author;
  if (targetDoc.encryptedAuthor) {
    try {
      const decryptedId = decryptAuthor(targetDoc.encryptedAuthor);
      if (decryptedId) authorId = decryptedId;
    } catch (decErr) {
      console.error('[AdminReveal] Decryption fallback to author ObjectId:', decErr.message);
    }
  }

  const user = await User.findById(authorId).select('_id username email karma verified role createdAt');
  if (!user) {
    throw new ApiError(404, 'Author user account no longer exists');
  }

  // Strictly log to AuditLog
  const audit = await AuditLog.create({
    admin: adminId,
    action: 'reveal_anonymous_author',
    targetType,
    targetId: targetDoc._id,
    reason: reason.trim(),
    revealedUser: user._id,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'] || null,
  });

  sendResponse(res, 200, 'Author deanonymized successfully with mandatory audit log', {
    author: {
      _id: user._id,
      username: user.username.startsWith('u/') ? user.username : `u/${user.username}`,
      email: user.email,
      karma: user.karma,
      verified: user.verified,
      role: user.role,
      createdAt: user.createdAt,
    },
    auditLog: {
      _id: audit._id,
      action: audit.action,
      reason: audit.reason,
      createdAt: audit.createdAt,
    },
  });
});

module.exports = {
  getStats,
  getReports,
  reviewReport,
  moderatePost,
  moderateComment,
  getUsers,
  revealAuthor,
};
