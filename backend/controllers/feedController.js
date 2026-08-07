const Post = require('../models/Post');
const CommunityMember = require('../models/CommunityMember');
const { enrichPosts } = require('../helpers/feedEnricher');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');

// Get sort query based on string
const getSortQuery = (sortType) => {
  switch (sortType) {
    case 'new':
      return { createdAt: -1 };
    case 'top':
      return { score: -1 };
    case 'hot':
    default:
      return { hotRank: -1 };
  }
};

// ─── Home Feed ────────────────────────────────────────────────────────────────
// Scoped to posts from communities the user has joined.
// Fallback to all popular posts if they have not joined any community.
const getHomeFeed = asyncHandler(async (req, res) => {
  const { sort = 'hot', page = 1, limit = 10 } = req.query;
  const userId = req.user ? req.user._id : null;

  let filter = { status: 'active' };

  if (userId) {
    // Find communities the user has joined
    const memberships = await CommunityMember.find({ user: userId });
    if (memberships.length > 0) {
      const communityIds = memberships.map((m) => m.community);
      filter.community = { $in: communityIds };
    }
  }

  const sortQuery = getSortQuery(sort);
  const skip = (Number(page) - 1) * Number(limit);

  const posts = await Post.find(filter)
    .sort(sortQuery)
    .skip(skip)
    .limit(Number(limit))
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const total = await Post.countDocuments(filter);
  const enriched = await enrichPosts(posts, userId);

  sendResponse(res, 200, 'Home feed retrieved successfully', {
    posts: enriched,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Latest Feed (Live / Chronological) ───────────────────────────────────────
const getLatestFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user ? req.user._id : null;

  const filter = { status: 'active' };
  const skip = (Number(page) - 1) * Number(limit);

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const total = await Post.countDocuments(filter);
  const enriched = await enrichPosts(posts, userId);

  sendResponse(res, 200, 'Latest feed retrieved successfully', {
    posts: enriched,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Popular Feed (Hot Ranking) ────────────────────────────────────────────────
const getPopularFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user ? req.user._id : null;

  const filter = { status: 'active' };
  const skip = (Number(page) - 1) * Number(limit);

  // Sorted by hotRank descending (pre-calculated with time decay and score)
  const posts = await Post.find(filter)
    .sort({ hotRank: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const total = await Post.countDocuments(filter);
  const enriched = await enrichPosts(posts, userId);

  sendResponse(res, 200, 'Popular feed retrieved successfully', {
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
  getHomeFeed,
  getLatestFeed,
  getPopularFeed,
};
