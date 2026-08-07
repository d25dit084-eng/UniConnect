const SavedPost = require('../models/SavedPost');
const Post = require('../models/Post');
const { enrichPosts } = require('../helpers/feedEnricher');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

// ─── Save Post ────────────────────────────────────────────────────────────────
const savePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(postId);
  if (!post || post.status === 'removed') {
    throw new ApiError(404, 'Post not found');
  }

  const existing = await SavedPost.findOne({ user: userId, post: postId });
  if (existing) {
    throw new ApiError(409, 'Post is already saved');
  }

  await SavedPost.create({ user: userId, post: postId });

  // Increment saveCount atomically
  await Post.findByIdAndUpdate(postId, { $inc: { saveCount: 1 } });

  sendResponse(res, 201, 'Post saved successfully', { saved: true });
});

// ─── Unsave Post ──────────────────────────────────────────────────────────────
const unsavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const saved = await SavedPost.findOneAndDelete({ user: userId, post: postId });
  if (!saved) {
    throw new ApiError(404, 'Post was not saved');
  }

  // Decrement saveCount atomically
  await Post.findByIdAndUpdate(postId, { $inc: { saveCount: -1 } });
  const post = await Post.findById(postId);
  if (post && post.saveCount < 0) {
    await Post.findByIdAndUpdate(postId, { $set: { saveCount: 0 } });
  }

  sendResponse(res, 200, 'Post unsaved successfully', { saved: false });
});

// ─── Get Saved Posts ──────────────────────────────────────────────────────────
const getSavedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const filter = { user: userId };
  const total = await SavedPost.countDocuments(filter);
  const skip = (page - 1) * limit;

  const savedEntries = await SavedPost.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'post',
      match: { status: { $ne: 'removed' } },
      populate: [
        { path: 'author', select: 'username avatar bio karma' },
        { path: 'community', select: 'name slug displayName icon' },
      ],
    });

  const posts = savedEntries
    .filter((s) => s.post !== null)
    .map((s) => s.post);

  const enriched = await enrichPosts(posts, userId);

  // Re-append savedAt timestamps
  const responsePosts = enriched.map((p) => {
    const entry = savedEntries.find((s) => s.post && s.post._id.toString() === p._id.toString());
    return {
      ...p,
      savedAt: entry ? entry.createdAt : null,
    };
  });

  const pages = Math.ceil(total / limit);

  sendResponse(res, 200, 'Saved posts retrieved successfully', {
    posts: responsePosts,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrevious: page > 1,
    },
  });
});

module.exports = { savePost, unsavePost, getSavedPosts };
