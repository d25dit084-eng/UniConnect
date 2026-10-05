const Community = require('../models/Community');
const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { isUserCommunityModerator } = require('../services/automodService');
const { serializeAuthor } = require('../helpers/authorSerializer');

/**
 * Helper to resolve community and verify moderator permissions
 */
const resolveModCommunity = async (slug, user) => {
  const community = await Community.findOne({ slug: slug.toLowerCase() });
  if (!community) {
    throw new ApiError(404, `Community c/${slug} not found`);
  }

  const isMod = await isUserCommunityModerator(community, user._id, user.role);
  if (!isMod) {
    throw new ApiError(403, 'You do not have moderator permissions for this community');
  }

  return community;
};

// ─── Get Community Moderation Reports ──────────────────────────────────────────
const getCommunityModReports = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  const community = await resolveModCommunity(slug, req.user);

  const filter = { community: community._id };
  if (status) {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const [total, pendingCount, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.countDocuments({ community: community._id, status: 'pending' }),
    Report.find(filter)
      .populate('reporter', 'username avatar')
      .populate('reviewedBy', 'username')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  // Enrich each report with target preview content
  const enrichedReports = await Promise.all(
    reports.map(async (r) => {
      let targetPreview = null;
      try {
        if (r.targetType === 'post') {
          const postDoc = await Post.findById(r.targetId)
            .select('title content status isAnonymous author createdAt')
            .lean();
          if (postDoc) {
            targetPreview = {
              title: postDoc.title,
              snippet: postDoc.content ? postDoc.content.slice(0, 200) : '',
              status: postDoc.status,
              isAnonymous: postDoc.isAnonymous,
              author: serializeAuthor(postDoc, req.user._id),
            };
          }
        } else if (r.targetType === 'comment') {
          const commentDoc = await Comment.findById(r.targetId)
            .select('content status isAnonymous author post createdAt')
            .populate('post', 'title')
            .lean();
          if (commentDoc) {
            targetPreview = {
              title: commentDoc.post?.title || 'Comment on post',
              snippet: commentDoc.content ? commentDoc.content.slice(0, 200) : '',
              status: commentDoc.status,
              isAnonymous: commentDoc.isAnonymous,
              author: serializeAuthor(commentDoc, req.user._id),
            };
          }
        }
      } catch (err) {
        // Silently tolerate missing target doc
      }

      return {
        ...r,
        targetPreview,
      };
    })
  );

  const pages = Math.ceil(total / limitNum) || 1;

  sendResponse(res, 200, 'Community reports retrieved successfully', {
    community: {
      _id: community._id,
      name: community.name,
      slug: community.slug,
      displayName: community.displayName,
    },
    reports: enrichedReports,
    stats: {
      total,
      pending: pendingCount,
    },
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages,
      hasNext: pageNum < pages,
      hasPrevious: pageNum > 1,
    },
  });
});

// ─── Action Community Moderation Report ───────────────────────────────────────
const actionCommunityModReport = asyncHandler(async (req, res) => {
  const { slug, id } = req.params;
  const { action, note = '' } = req.body;

  const VALID_ACTIONS = ['approve', 'dismiss', 'remove', 'warn_author'];
  if (!VALID_ACTIONS.includes(action)) {
    throw new ApiError(400, `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`);
  }

  const community = await resolveModCommunity(slug, req.user);

  const report = await Report.findOne({ _id: id, community: community._id });
  if (!report) {
    throw new ApiError(404, 'Report not found in this community');
  }

  let auditAction = 'review_report';
  let targetAuthorId = null;

  if (action === 'approve' || action === 'dismiss') {
    report.status = 'dismissed';
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.moderationNote = note || `Approved by c/${community.name} moderator`;

    // If quarantined (hidden), restore to active
    if (report.targetType === 'post') {
      const p = await Post.findById(report.targetId);
      if (p && p.status === 'hidden') {
        p.status = 'active';
        await p.save();
      }
    } else if (report.targetType === 'comment') {
      const c = await Comment.findById(report.targetId);
      if (c && c.status === 'hidden') {
        c.status = 'active';
        await c.save();
      }
    }
  } else if (action === 'remove') {
    report.status = 'actioned';
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.moderationNote = note || `Content removed by c/${community.name} moderator`;

    if (report.targetType === 'post') {
      auditAction = 'delete_post';
      const post = await Post.findById(report.targetId);
      if (post) {
        targetAuthorId = post.author;
        post.status = 'removed';
        await post.save();
        await Community.findByIdAndUpdate(community._id, { $inc: { postsCount: -1 } });
      }
    } else if (report.targetType === 'comment') {
      auditAction = 'delete_comment';
      const comment = await Comment.findById(report.targetId);
      if (comment) {
        targetAuthorId = comment.author;
        comment.status = 'removed';
        await comment.save();
      }
    }
  } else if (action === 'warn_author') {
    report.status = 'actioned';
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.moderationNote = note || `Author warned by c/${community.name} moderator`;

    // Find author to warn
    if (report.targetType === 'post') {
      const p = await Post.findById(report.targetId);
      if (p) targetAuthorId = p.author;
    } else if (report.targetType === 'comment') {
      const c = await Comment.findById(report.targetId);
      if (c) targetAuthorId = c.author;
    }

    if (targetAuthorId) {
      await Notification.create({
        recipient: targetAuthorId,
        actor: req.user._id,
        type: 'moderator_action',
        community: community._id,
        message: `Moderator notice from c/${community.name}: ${note || 'Your post/comment was flagged for community guideline adherence.'}`,
      });
    }
  }

  await report.save();

  // Log in AuditLog
  try {
    await AuditLog.create({
      admin: req.user._id,
      action: auditAction,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: note || `c/${community.name} moderator action: ${action}`,
    });
  } catch (err) {
    // Non-fatal if audit log fails validation
  }

  sendResponse(res, 200, `Report action '${action}' completed successfully`, {
    report,
  });
});

// ─── Get Community Moderation Settings ─────────────────────────────────────────
const getCommunityModSettings = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const community = await resolveModCommunity(slug, req.user);

  sendResponse(res, 200, 'Moderation settings retrieved', {
    community: {
      _id: community._id,
      name: community.name,
      slug: community.slug,
      displayName: community.displayName,
      automodKeywords: community.automodKeywords || [],
      automodEnabled: community.automodEnabled !== false,
      rules: community.rules || [],
    },
  });
});

// ─── Update Community Moderation Settings ──────────────────────────────────────
const updateCommunityModSettings = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { automodKeywords, automodEnabled, rules } = req.body;

  const community = await resolveModCommunity(slug, req.user);

  if (Array.isArray(automodKeywords)) {
    community.automodKeywords = automodKeywords
      .map((k) => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
      .filter(Boolean)
      .slice(0, 100); // Up to 100 custom keywords
  }

  if (typeof automodEnabled === 'boolean') {
    community.automodEnabled = automodEnabled;
  }

  if (Array.isArray(rules)) {
    community.rules = rules
      .filter((r) => r && r.title)
      .map((r) => ({
        title: r.title.trim().slice(0, 100),
        description: (r.description || '').trim().slice(0, 500),
      }));
  }

  await community.save();

  sendResponse(res, 200, 'Moderation settings updated successfully', {
    community: {
      _id: community._id,
      name: community.name,
      slug: community.slug,
      displayName: community.displayName,
      automodKeywords: community.automodKeywords,
      automodEnabled: community.automodEnabled,
      rules: community.rules,
    },
  });
});

module.exports = {
  getCommunityModReports,
  actionCommunityModReport,
  getCommunityModSettings,
  updateCommunityModSettings,
};
