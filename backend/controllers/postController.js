const Post = require('../models/Post');
const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const Vote = require('../models/Vote');
const { enrichPosts } = require('../helpers/feedEnricher');
const { calculateHotRank } = require('../services/rankingService');
const { updateKarma } = require('../services/karmaService');
const { broadcastNewPost } = require('../services/socketService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

// ─── Create Post ──────────────────────────────────────────────────────────────
const createPost = asyncHandler(async (req, res) => {
  const { communityId, type = 'text', title, content, url, media } = req.body;
  const authorId = req.user._id;

  // 1. Verify community exists
  const community = await Community.findById(communityId);
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  // 2. Verify permission to post (e.g. if private, must be a member)
  if (community.visibility === 'private') {
    const isMember = await CommunityMember.findOne({ community: communityId, user: authorId });
    if (!isMember) {
      throw new ApiError(403, 'You must be a member of this private community to post');
    }
  }

  // 3. Post type validations
  if (type === 'link' && !url) {
    throw new ApiError(400, 'URL is required for link posts');
  }
  if (type === 'image' && (!media || media.length === 0)) {
    throw new ApiError(400, 'Media attachments are required for image posts');
  }
  if (type === 'text' && !content) {
    throw new ApiError(400, 'Content is required for text posts');
  }

  // 4. Create the post (Starts with 1 upvote from the author)
  const post = await Post.create({
    author: authorId,
    community: communityId,
    type,
    title: title.trim(),
    content: content ? content.trim() : '',
    url: type === 'link' ? url.trim() : null,
    media: type === 'image' ? (Array.isArray(media) ? media : [media]) : [],
    upvoteCount: 1,
    downvoteCount: 0,
    score: 1,
    hotRank: 0,
  });

  // Calculate and store initial hot rank
  post.hotRank = calculateHotRank(1, 0, post.createdAt);
  await post.save();

  // Create the vote object for the author upvoting their own post
  await Vote.create({
    user: authorId,
    targetType: 'post',
    targetId: post._id,
    value: 1,
  });

  // Add 1 post karma to the author
  await updateKarma(authorId, 'post', 1);

  // Increment community postsCount atomically
  await Community.findByIdAndUpdate(communityId, { $inc: { postsCount: 1 } });

  // Populates details for response
  const populated = await Post.findById(post._id)
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const [enriched] = await enrichPosts([populated], authorId);

  // Broadcast the new post event globally to active socket clients
  try {
    broadcastNewPost(enriched);
  } catch (err) {
    // Silently ignore socket broadcast failures in controller
  }

  sendResponse(res, 201, 'Post created successfully', { post: enriched });
});

// ─── Get Single Post By ID ─────────────────────────────────────────────────────
const getPostById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user ? req.user._id : null;

  const post = await Post.findById(id)
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  if (!post || post.status === 'removed') {
    throw new ApiError(404, 'Post not found');
  }

  // Increment views
  post.viewCount += 1;
  await post.save();

  const [enriched] = await enrichPosts([post], userId);

  sendResponse(res, 200, 'Post retrieved successfully', { post: enriched });
});

// ─── Update Post ──────────────────────────────────────────────────────────────
const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, url, media } = req.body;
  const userId = req.user._id;

  const post = await Post.findById(id);
  if (!post || post.status === 'removed') {
    throw new ApiError(404, 'Post not found');
  }

  // Only the author can edit
  if (post.author.toString() !== userId.toString()) {
    throw new ApiError(403, 'You are not authorized to edit this post');
  }

  if (title !== undefined) post.title = title.trim();
  if (content !== undefined) post.content = content.trim();
  if (url !== undefined) post.url = url.trim();
  if (media !== undefined) post.media = Array.isArray(media) ? media : [media];
  post.edited = true;

  await post.save();

  const populated = await Post.findById(post._id)
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const [enriched] = await enrichPosts([populated], userId);

  sendResponse(res, 200, 'Post updated successfully', { post: enriched });
});

// ─── Delete Post ──────────────────────────────────────────────────────────────
const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(id);
  if (!post || post.status === 'removed') {
    throw new ApiError(404, 'Post not found');
  }

  // Author or platform admin can delete
  const isAuthor = post.author.toString() === userId.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    throw new ApiError(403, 'You are not authorized to delete this post');
  }

  await Post.deleteOne({ _id: id });
  
  // Decrement community postsCount
  await Community.findByIdAndUpdate(post.community, { $inc: { postsCount: -1 } });
  
  // Clean up votes and saved post references
  await Vote.deleteMany({ targetType: 'post', targetId: id });
  await SavedPost.deleteMany({ post: id });

  sendResponse(res, 200, 'Post deleted successfully');
});

// ─── Get Posts in Community (Community Feed) ──────────────────────────────────
const getCommunityPosts = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { sort = 'hot', page = 1, limit = 10 } = req.query;
  const userId = req.user ? req.user._id : null;

  const community = await Community.findOne({ slug: slug.toLowerCase() });
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  // Visibility permissions
  if (community.visibility === 'private') {
    if (!userId) {
      throw new ApiError(401, 'Authentication required to view private community posts');
    }
    const isMember = await CommunityMember.findOne({ community: community._id, user: userId });
    if (!isMember) {
      throw new ApiError(403, 'You must be a member of this private community to view posts');
    }
  }

  const filter = { community: community._id, status: 'active' };
  const skip = (Number(page) - 1) * Number(limit);

  let sortQuery = { hotRank: -1 };
  if (sort === 'new') {
    sortQuery = { createdAt: -1 };
  } else if (sort === 'top') {
    sortQuery = { score: -1 };
  } else if (sort === 'controversial') {
    sortQuery = { commentCount: -1 };
  }

  const posts = await Post.find(filter)
    .sort(sortQuery)
    .skip(skip)
    .limit(Number(limit))
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const total = await Post.countDocuments(filter);
  const enriched = await enrichPosts(posts, userId);

  sendResponse(res, 200, 'Community posts retrieved successfully', {
    posts: enriched,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Search Posts ─────────────────────────────────────────────────────────────
const searchPosts = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10, sort = 'hot' } = req.query;
  const userId = req.user ? req.user._id : null;

  if (!q || !q.trim()) {
    return sendResponse(res, 200, 'Search results', {
      posts: [],
      pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
    });
  }

  const filter = {
    status: 'active',
    $text: { $search: q.trim() },
  };

  const skip = (Number(page) - 1) * Number(limit);

  let sortQuery = { score: { $meta: 'textScore' } };
  if (sort === 'new') {
    sortQuery = { createdAt: -1 };
  } else if (sort === 'top') {
    sortQuery = { score: -1 };
  }

  const posts = await Post.find(filter, { textScore: { $meta: 'textScore' } })
    .sort(sortQuery)
    .skip(skip)
    .limit(Number(limit))
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const total = await Post.countDocuments(filter);
  const enriched = await enrichPosts(posts, userId);

  sendResponse(res, 200, `Found ${total} result(s) for "${q.trim()}"`, {
    posts: enriched,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

module.exports = {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getCommunityPosts,
  searchPosts,
};
