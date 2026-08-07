const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  validateStoredRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require('../services/tokenService');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/emailService');

// ─── Register ─────────────────────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Check for existing user
  const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingEmail) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const existingUsername = await User.findOne({
    username: { $regex: new RegExp(`^${username.trim()}$`, 'i') },
  });
  if (existingUsername) {
    throw new ApiError(409, 'Username is already taken');
  }

  // Create user — password hashed via pre-save hook
  const user = await User.create({
    username: username.trim(),
    email: email.toLowerCase().trim(),
    password,
  });

  sendResponse(res, 201, 'Registration successful. Please verify your email.', {
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      verified: user.verified,
      role: user.role,
    },
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Include password for comparison (excluded by default via select:false)
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  // Generic error — don't reveal if email exists
  const invalidCredentials = new ApiError(401, 'Invalid email or password');

  if (!user) throw invalidCredentials;

  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) throw invalidCredentials;

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, req);

  // Set refresh token in HttpOnly cookie for security
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  sendResponse(res, 200, 'Logged in successfully', {
    accessToken,
    user: user.toPublicProfile(),
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (token) {
    await revokeRefreshToken(token);
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  sendResponse(res, 200, 'Logged out successfully');
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    throw new ApiError(401, 'No refresh token provided');
  }

  // Verify JWT signature and expiry
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  // Validate against stored hash (checks revocation)
  const storedToken = await validateStoredRefreshToken(token);
  if (!storedToken) {
    throw new ApiError(401, 'Refresh token has been revoked or expired');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  // Token rotation: revoke old, issue new
  await revokeRefreshToken(token);
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = await generateRefreshToken(user, req);

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendResponse(res, 200, 'Token refreshed successfully', {
    accessToken: newAccessToken,
  });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Always return 200 to avoid email enumeration
  const genericMessage =
    'If an account with that email exists, a password reset link has been sent.';

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    '+resetPasswordToken +resetPasswordExpires'
  );

  if (!user) {
    // Don't reveal that the email wasn't found
    return sendResponse(res, 200, genericMessage);
  }

  // Generate cryptographically secure raw token
  const rawToken = crypto.randomBytes(32).toString('hex');

  // Store hashed version — never store raw tokens
  user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  await user.save({ validateBeforeSave: false });

  // Send email (dev: logs to console)
  await sendPasswordResetEmail(user.email, rawToken);

  sendResponse(res, 200, genericMessage);
});

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) {
    throw new ApiError(400, 'Reset token is required');
  }

  // Hash the incoming raw token to compare with stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  // Update password — pre-save hook handles hashing
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Invalidate all existing refresh sessions for security
  await revokeAllUserRefreshTokens(user._id);

  sendResponse(res, 200, 'Password reset successfully. Please log in with your new password.');
});

module.exports = { register, login, logout, refreshToken, forgotPassword, resetPassword };
