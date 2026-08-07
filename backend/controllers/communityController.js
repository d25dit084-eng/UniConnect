const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const Post = require('../models/Post');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');

// ─── Create Community ──────────────────────────────────────────────────────────
const createCommunity = asyncHandler(async (req, res) => {
  const { name, displayName, description, icon, banner, rules } = req.body;
  const userId = req.user._id;

  const slug = name.trim().toLowerCase();

  // Check if slug is already taken
  const existing = await Community.findOne({ slug });
  if (existing) {
    throw new ApiError(409, `Community c/${slug} already exists`);
  }

  // Create community
  const community = await Community.create({
    name: name.trim(),
    slug,
    displayName: displayName.trim(),
    description: description.trim(),
    icon: icon || null,
    banner: banner || null,
    creator: userId,
    moderators: [userId],
    rules: rules || [],
    membersCount: 1, // Creator is the first member
  });

  // Create membership relation
  await CommunityMember.create({
    community: community._id,
    user: userId,
    role: 'owner',
  });

  sendResponse(res, 201, 'Community created successfully', { community });
});

// ─── Get Communities (List / Search) ───────────────────────────────────────────
const getCommunities = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10, sort = 'members' } = req.query;

  const filter = { visibility: 'public' };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { displayName: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
  }

  let sortQuery = { membersCount: -1 };
  if (sort === 'posts') {
    sortQuery = { postsCount: -1 };
  } else if (sort === 'newest') {
    sortQuery = { createdAt: -1 };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const communities = await Community.find(filter)
    .sort(sortQuery)
    .skip(skip)
    .limit(Number(limit))
    .populate('creator', 'username avatar');

  const total = await Community.countDocuments(filter);

  sendResponse(res, 200, 'Communities retrieved successfully', {
    communities,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Get Community By Slug ─────────────────────────────────────────────────────
const getCommunityBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const community = await Community.findOne({ slug: slug.toLowerCase() })
    .populate('creator', 'username avatar')
    .populate('moderators', 'username avatar');

  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  // Check if requester is joined
  let isJoined = false;
  let memberRole = null;
  if (req.user) {
    const membership = await CommunityMember.findOne({
      community: community._id,
      user: req.user._id,
    });
    if (membership) {
      isJoined = true;
      memberRole = membership.role;
    }
  }

  const responseData = community.toObject();
  responseData.isJoined = isJoined;
  responseData.memberRole = memberRole;

  sendResponse(res, 200, 'Community retrieved successfully', { community: responseData });
});

// ─── Update Community ──────────────────────────────────────────────────────────
const updateCommunity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { displayName, description, icon, banner, rules, visibility } = req.body;
  const userId = req.user._id;

  const community = await Community.findById(id);
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  // Check permissions: creator or moderator
  const isModerator = community.moderators.map((m) => m.toString()).includes(userId.toString());
  if (!isModerator && community.creator.toString() !== userId.toString()) {
    throw new ApiError(403, 'You do not have permission to manage this community');
  }

  // Update allowed fields
  if (displayName) community.displayName = displayName.trim();
  if (description) community.description = description.trim();
  if (icon !== undefined) community.icon = icon;
  if (banner !== undefined) community.banner = banner;
  if (rules !== undefined) community.rules = rules;
  if (visibility) community.visibility = visibility;

  await community.save();

  sendResponse(res, 200, 'Community updated successfully', { community });
});

// ─── Delete Community ──────────────────────────────────────────────────────────
const deleteCommunity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const community = await Community.findById(id);
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  // Only owner (creator) can delete a community
  if (community.creator.toString() !== userId.toString()) {
    throw new ApiError(403, 'Only the community creator can delete it');
  }

  await Community.deleteOne({ _id: id });
  await CommunityMember.deleteMany({ community: id });
  await Post.deleteMany({ community: id }); // Cascade delete posts in community

  sendResponse(res, 200, 'Community deleted successfully');
});

// ─── Join Community ────────────────────────────────────────────────────────────
const joinCommunity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const community = await Community.findById(id);
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  // Check if already a member
  const existing = await CommunityMember.findOne({ community: id, user: userId });
  if (existing) {
    throw new ApiError(409, 'You are already a member of this community');
  }

  // Create membership
  await CommunityMember.create({
    community: id,
    user: userId,
    role: 'member',
  });

  // Increment membership count atomically
  await Community.findByIdAndUpdate(id, { $inc: { membersCount: 1 } });

  sendResponse(res, 200, 'Joined community successfully');
});

// ─── Leave Community ───────────────────────────────────────────────────────────
const leaveCommunity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const community = await Community.findById(id);
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  const membership = await CommunityMember.findOne({ community: id, user: userId });
  if (!membership) {
    throw new ApiError(404, 'You are not a member of this community');
  }

  // Owner rules: cannot leave if they are the creator/owner
  if (membership.role === 'owner' || community.creator.toString() === userId.toString()) {
    throw new ApiError(400, 'As the owner, you cannot leave the community. Demote or transfer ownership first, or delete it.');
  }

  await CommunityMember.deleteOne({ _id: membership._id });

  // Decrement membership count atomically
  await Community.findByIdAndUpdate(id, {
    $inc: { membersCount: -1 },
  });

  // Safe guard count
  const updatedCommunity = await Community.findById(id);
  if (updatedCommunity.membersCount < 0) {
    await Community.findByIdAndUpdate(id, { $set: { membersCount: 0 } });
  }

  sendResponse(res, 200, 'Left community successfully');
});

// ─── Get Joined Communities ────────────────────────────────────────────────────
const getJoinedCommunities = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const memberships = await CommunityMember.find({ user: userId })
    .populate({
      path: 'community',
      populate: { path: 'creator', select: 'username avatar' },
    });

  const communities = memberships
    .filter((m) => m.community !== null)
    .map((m) => {
      const c = m.community.toObject();
      c.memberRole = m.role;
      return c;
    });

  sendResponse(res, 200, 'Joined communities retrieved successfully', { communities });
});

// ─── Get Community Members ─────────────────────────────────────────────────────
const getCommunityMembers = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const community = await Community.findOne({ slug: slug.toLowerCase() });
  if (!community) {
    throw new ApiError(404, 'Community not found');
  }

  const skip = (Number(page) - 1) * Number(limit);

  const members = await CommunityMember.find({ community: community._id })
    .skip(skip)
    .limit(Number(limit))
    .populate('user', 'username avatar bio karma');

  const total = await CommunityMember.countDocuments({ community: community._id });

  // Return public details only
  const publicMembers = members.map((m) => ({
    _id: m._id,
    role: m.role,
    joinedAt: m.joinedAt,
    user: m.user ? m.user.toPublicProfile() : null,
  }));

  sendResponse(res, 200, 'Community members retrieved successfully', {
    members: publicMembers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

module.exports = {
  createCommunity,
  getCommunities,
  getCommunityBySlug,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getJoinedCommunities,
  getCommunityMembers,
};
