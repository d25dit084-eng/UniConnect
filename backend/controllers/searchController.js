const Post = require('../models/Post');
const Community = require('../models/Community');
const User = require('../models/User');
const { enrichPosts } = require('../helpers/feedEnricher');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

// ─── Global Search ─────────────────────────────────────────────────────────────
const search = asyncHandler(async (req, res) => {
  const { q, type = 'posts', page = 1, limit = 10 } = req.query;
  const userId = req.user ? req.user._id : null;

  if (!q || !q.trim()) {
    return sendResponse(res, 200, 'Search results', {
      results: [],
      pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
    });
  }

  const queryText = q.trim();
  const skip = (Number(page) - 1) * Number(limit);

  if (type === 'posts') {
    const filter = {
      status: 'active',
      $text: { $search: queryText },
    };

    const posts = await Post.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(Number(limit))
      .populate('author', 'username avatar bio karma')
      .populate('community', 'name slug displayName icon');

    const total = await Post.countDocuments(filter);
    const enriched = await enrichPosts(posts, userId);

    return sendResponse(res, 200, `Found ${total} post(s) for "${queryText}"`, {
      results: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }

  if (type === 'communities') {
    const filter = {
      visibility: 'public',
      $or: [
        { name: { $regex: queryText, $options: 'i' } },
        { displayName: { $regex: queryText, $options: 'i' } },
        { description: { $regex: queryText, $options: 'i' } },
      ],
    };

    const communities = await Community.find(filter)
      .sort({ membersCount: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Community.countDocuments(filter);

    return sendResponse(res, 200, `Found ${total} community/communities for "${queryText}"`, {
      results: communities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }

  if (type === 'users') {
    // Clean search term from 'u/' prefix if present
    const cleanQuery = queryText.startsWith('u/') ? queryText.substring(2) : queryText;

    const filter = {
      username: { $regex: cleanQuery, $options: 'i' },
      profileVisibility: { $ne: false }, // respect privacy settings
    };

    const users = await User.find(filter)
      .select('username avatar bio karma createdAt')
      .sort({ 'karma.total': -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    // Format public usernames
    const publicUsers = users.map((u) => {
      const obj = u.toObject();
      obj.username = obj.username.startsWith('u/') ? obj.username : `u/${obj.username}`;
      obj.avatar = obj.avatar || obj.profileImage || null;
      return obj;
    });

    return sendResponse(res, 200, `Found ${total} user(s) for "${queryText}"`, {
      results: publicUsers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }

  throw new ApiError(400, 'Invalid search type. Must be posts, communities, or users');
});

module.exports = { search };
