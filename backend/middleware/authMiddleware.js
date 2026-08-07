const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches safe user data to req.user.
 */
const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided. Please log in.');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'No token provided. Please log in.');
  }

  // Verify JWT — throws if expired or invalid
  const decoded = verifyAccessToken(token);

  // Fetch user from DB (ensures user still exists and is not deleted)
  // password and tokens excluded via schema select:false
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ApiError(401, 'User no longer exists.');
  }

  // Attach safe user to request — no password, no tokens
  req.user = user;
  next();
});

/**
 * Optional authentication middleware.
 * If a valid Bearer token is present, attaches req.user like protect does.
 * If no token or invalid token, continues without error — req.user remains undefined.
 * Used on public routes that optionally enrich responses for authenticated users
 * (e.g., likedByMe, savedByMe on the feed).
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);
    if (user) req.user = user;
  } catch (_) {
    // Ignore invalid/expired tokens — treat as guest
  }

  next();
});

module.exports = { protect, optionalAuth };

