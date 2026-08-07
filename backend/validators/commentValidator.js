const ApiError = require('../utils/ApiError');

// ─── Create Comment ───────────────────────────────────────────────────────────

const validateCreateComment = (req, res, next) => {
  const { postId, content } = req.body;
  const errors = [];

  if (!postId || typeof postId !== 'string') {
    errors.push('postId is required');
  }

  if (!content || typeof content !== 'string' || content.trim().length < 1) {
    errors.push('Comment content is required');
  } else if (content.trim().length > 2000) {
    errors.push('Comment cannot exceed 2000 characters');
  }

  if (errors.length > 0) {
    return next(new ApiError(400, errors.join('. ')));
  }

  next();
};

// ─── Create Reply ─────────────────────────────────────────────────────────────

const validateCreateReply = (req, res, next) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length < 1) {
    return next(new ApiError(400, 'Reply content is required'));
  }

  if (content.trim().length > 2000) {
    return next(new ApiError(400, 'Reply cannot exceed 2000 characters'));
  }

  next();
};

// ─── Update Comment ───────────────────────────────────────────────────────────

const validateUpdateComment = (req, res, next) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length < 1) {
    return next(new ApiError(400, 'Updated content is required'));
  }

  if (content.trim().length > 2000) {
    return next(new ApiError(400, 'Comment cannot exceed 2000 characters'));
  }

  next();
};

module.exports = {
  validateCreateComment,
  validateCreateReply,
  validateUpdateComment,
};
