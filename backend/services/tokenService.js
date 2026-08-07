const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

// ─── Token Generation ─────────────────────────────────────────────────────────

/**
 * Generate a JWT access token. Contains only id and role — no sensitive data.
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

/**
 * Generate a JWT refresh token and persist a hashed copy to the database.
 * Returns the raw token (sent to client) — the raw token is never stored.
 */
const generateRefreshToken = async (user, req = {}) => {
  const rawToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  // Hash before storing — protects against DB breaches
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresIn7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: expiresIn7Days,
    userAgent: req.headers?.['user-agent'] || '',
    ipAddress: req.ip || '',
  });

  return rawToken;
};

// ─── Token Verification ───────────────────────────────────────────────────────

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ─── Refresh Token Rotation ───────────────────────────────────────────────────

/**
 * Validate a raw refresh token against stored hashes.
 * Returns the RefreshToken document if valid.
 */
const validateStoredRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const stored = await RefreshToken.findOne({
    tokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
  return stored;
};

/**
 * Revoke a specific refresh token by its raw value.
 */
const revokeRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await RefreshToken.findOneAndUpdate({ tokenHash }, { isRevoked: true });
};

/**
 * Revoke all refresh tokens for a user (e.g., on password reset).
 */
const revokeAllUserRefreshTokens = async (userId) => {
  await RefreshToken.updateMany({ user: userId }, { isRevoked: true });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  validateStoredRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};
