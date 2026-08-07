const ApiError = require('../utils/ApiError');

/**
 * Central error handler middleware.
 * Must be registered LAST in Express (after all routes).
 *
 * Handles:
 *  - ApiError (our custom operational errors)
 *  - Mongoose CastError (invalid ObjectId)
 *  - Mongoose ValidationError
 *  - Mongoose duplicate key (11000)
 *  - JsonWebTokenError / TokenExpiredError
 *  - Unexpected errors (500)
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // ── Mongoose: invalid ObjectId ──────────────────────────────────────────────
  if (err.name === 'CastError') {
    error = new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }

  // ── Mongoose: validation errors ─────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, messages.join('. '));
  }

  // ── MongoDB: duplicate key ──────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new ApiError(409, `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Value'} already exists`);
  }

  // ── JWT: invalid token ──────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token. Please log in again.');
  }

  // ── JWT: expired token ──────────────────────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token expired. Please log in again.');
  }

  // ── Multer: file too large ──────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError(400, 'File size exceeds the 5MB limit.');
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log unexpected errors in dev/production
  if (statusCode === 500) {
    console.error('[Server Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode === 500
      ? { stack: err.stack }
      : {}),
  });
};

module.exports = errorHandler;
