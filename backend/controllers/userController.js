const crypto = require('crypto');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');
const Block = require('../models/Block');
const { enrichPosts } = require('../helpers/feedEnricher');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const { sendVerificationEmail } = require('../services/emailService');

// Helper to clean up "u/" prefix from username input
const cleanUsername = (username) => {
  if (typeof username !== 'string') return '';
  return username.trim().startsWith('u/') ? username.trim().substring(2) : username.trim();
};

// ─── Get Private Profile (Own Account / /me) ──────────────────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Return full details including private settings
  const privateProfile = {
    _id: user._id,
    username: user.username.startsWith('u/') ? user.username : `u/${user.username}`,
    email: user.email,
    avatar: user.avatar || user.profileImage || null,
    bio: user.bio || '',
    karma: user.karma || { post: 0, comment: 0, total: 0 },
    verified: user.verified,
    role: user.role,
    allowDirectMessages: user.allowDirectMessages !== false,
    showOnlineStatus: user.showOnlineStatus !== false,
    profileVisibility: user.profileVisibility !== false,
    interests: user.interests || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  sendResponse(res, 200, 'Profile retrieved successfully', { user: privateProfile });
});

// ─── Get Public Profile (By Username) ──────────────────────────────────────────
const getPublicProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const targetUsername = cleanUsername(username);

  const user = await User.findOne({
    username: { $regex: new RegExp(`^${targetUsername}$`, 'i') },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Enforce privacy: if profileVisibility is false, restrict access
  if (user.profileVisibility === false && (!req.user || req.user._id.toString() !== user._id.toString())) {
    throw new ApiError(403, 'This user profile is private');
  }

  sendResponse(res, 200, 'Public profile retrieved successfully', {
    user: user.toPublicProfile(),
  });
});

// ─── Get Public Posts By Username ─────────────────────────────────────────────
const getPublicPosts = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user ? req.user._id : null;

  const targetUsername = cleanUsername(username);
  const user = await User.findOne({
    username: { $regex: new RegExp(`^${targetUsername}$`, 'i') },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Enforce privacy settings
  if (user.profileVisibility === false && (!req.user || req.user._id.toString() !== user._id.toString())) {
    throw new ApiError(403, 'This user profile is private');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const filter = { author: user._id, status: 'active' };

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('author', 'username avatar bio karma')
    .populate('community', 'name slug displayName icon');

  const total = await Post.countDocuments(filter);
  const enriched = await enrichPosts(posts, userId);

  sendResponse(res, 200, 'User posts retrieved successfully', {
    posts: enriched,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Update Profile ───────────────────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { bio, avatar, allowDirectMessages, showOnlineStatus, profileVisibility, interests } = req.body;

  const updates = {};
  if (bio !== undefined) updates.bio = bio;
  if (avatar !== undefined) updates.avatar = avatar;
  if (allowDirectMessages !== undefined) updates.allowDirectMessages = Boolean(allowDirectMessages);
  if (showOnlineStatus !== undefined) updates.showOnlineStatus = Boolean(showOnlineStatus);
  if (profileVisibility !== undefined) updates.profileVisibility = Boolean(profileVisibility);
  if (interests !== undefined) updates.interests = interests;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { returnDocument: 'after', runValidators: true }
  );

  const privateProfile = {
    _id: updatedUser._id,
    username: updatedUser.username.startsWith('u/') ? updatedUser.username : `u/${updatedUser.username}`,
    email: updatedUser.email,
    avatar: updatedUser.avatar || updatedUser.profileImage || null,
    bio: updatedUser.bio || '',
    karma: updatedUser.karma || { post: 0, comment: 0, total: 0 },
    verified: updatedUser.verified,
    role: updatedUser.role,
    allowDirectMessages: updatedUser.allowDirectMessages !== false,
    showOnlineStatus: updatedUser.showOnlineStatus !== false,
    profileVisibility: updatedUser.profileVisibility !== false,
    interests: updatedUser.interests || [],
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  };

  sendResponse(res, 200, 'Profile updated successfully', {
    user: privateProfile,
  });
});

// ─── Block User ───────────────────────────────────────────────────────────────
const blockUser = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const blockerId = req.user._id;

  const targetUsername = cleanUsername(username);
  const targetUser = await User.findOne({
    username: { $regex: new RegExp(`^${targetUsername}$`, 'i') },
  });

  if (!targetUser) {
    throw new ApiError(404, 'User to block not found');
  }

  if (blockerId.toString() === targetUser._id.toString()) {
    throw new ApiError(400, 'You cannot block yourself');
  }

  // Create block relation (unique index prevents duplicates)
  try {
    await Block.create({
      blocker: blockerId,
      blocked: targetUser._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You have already blocked this user');
    }
    throw err;
  }

  sendResponse(res, 200, `Blocked u/${targetUser.username} successfully`);
});

// ─── Unblock User ─────────────────────────────────────────────────────────────
const unblockUser = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const blockerId = req.user._id;

  const targetUsername = cleanUsername(username);
  const targetUser = await User.findOne({
    username: { $regex: new RegExp(`^${targetUsername}$`, 'i') },
  });

  if (!targetUser) {
    throw new ApiError(404, 'User to unblock not found');
  }

  const result = await Block.deleteOne({
    blocker: blockerId,
    blocked: targetUser._id,
  });

  if (result.deletedCount === 0) {
    throw new ApiError(404, 'You have not blocked this user');
  }

  sendResponse(res, 200, `Unblocked u/${targetUser.username} successfully`);
});

// ─── Get Blocked Users ─────────────────────────────────────────────────────────
const getBlockedUsers = asyncHandler(async (req, res) => {
  const blockerId = req.user._id;

  const blocks = await Block.find({ blocker: blockerId }).populate(
    'blocked',
    'username avatar bio karma'
  );

  const blockedUsers = blocks.map((b) => {
    if (!b.blocked) return null;
    const u = b.blocked.toObject();
    u.username = u.username.startsWith('u/') ? u.username : `u/${u.username}`;
    u.avatar = u.avatar || u.profileImage || null;
    return u;
  }).filter(Boolean);

  sendResponse(res, 200, 'Blocked users list retrieved successfully', { blocked: blockedUsers });
});

// ─── Request Email Verification ───────────────────────────────────────────────
const requestVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    '+verificationToken +verificationTokenExpires'
  );

  if (user.verified) {
    throw new ApiError(400, 'Your account is already verified');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.verificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  await sendVerificationEmail(user.email, rawToken);

  sendResponse(res, 200, 'Verification email sent. Check your inbox.');
});

// ─── Confirm Email Verification Token ────────────────────────────────────────
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError(400, 'Verification token is required');
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: new Date() },
  }).select('+verificationToken +verificationTokenExpires');

  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  user.verified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, 'Email verified successfully!', {
    user: user.toPublicProfile(),
  });
});

// ─── Upload Profile Image ─────────────────────────────────────────────────────
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No image file provided');
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: imageUrl, profileImage: imageUrl },
    { returnDocument: 'after' }
  );

  sendResponse(res, 200, 'Profile image uploaded successfully', {
    avatar: imageUrl,
    user: updatedUser.toPublicProfile(),
  });
});

module.exports = {
  getProfile,
  getPublicProfile,
  getPublicPosts,
  updateProfile,
  blockUser,
  unblockUser,
  getBlockedUsers,
  requestVerification,
  verifyEmail,
  uploadProfileImage,
};
