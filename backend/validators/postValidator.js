const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

// ─── Create Post Validator ─────────────────────────────────────────────────────
const validateCreatePost = (req, res, next) => {
  const { communityId, type, title, content, url, media } = req.body;
  const errors = [];

  // 1. Title validation
  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    errors.push('Title is required and must be at least 5 characters');
  } else if (title.trim().length > 200) {
    errors.push('Title cannot exceed 200 characters');
  }

  // 2. CommunityId validation
  if (!communityId) {
    errors.push('Community ID is required');
  } else if (!mongoose.Types.ObjectId.isValid(communityId)) {
    errors.push('Invalid Community ID format');
  }

  // 3. Post Type validation
  const validTypes = ['text', 'image', 'link'];
  if (!type) {
    errors.push('Post type is required');
  } else if (!validTypes.includes(type)) {
    errors.push('Post type must be one of: text, image, link');
  } else {
    // Conditional requirements based on type
    if (type === 'text') {
      if (!content || typeof content !== 'string' || content.trim().length < 10) {
        errors.push('Content is required for text posts and must be at least 10 characters');
      } else if (content.length > 5000) {
        errors.push('Content cannot exceed 5000 characters');
      }
    } else if (type === 'link') {
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        errors.push('URL is required for link posts');
      }
    } else if (type === 'image') {
      if (!media || (Array.isArray(media) && media.length === 0)) {
        errors.push('At least one media attachment is required for image posts');
      }
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(400, errors.join('. ')));
  }

  next();
};

// ─── Update Post Validator ─────────────────────────────────────────────────────
const validateUpdatePost = (req, res, next) => {
  const { title, content, url, media } = req.body;
  const errors = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 200) {
      errors.push('Title must be between 5 and 200 characters');
    }
  }

  if (content !== undefined) {
    if (typeof content !== 'string' || content.trim().length > 5000) {
      errors.push('Content cannot exceed 5000 characters');
    }
  }

  if (url !== undefined) {
    if (typeof url !== 'string' || url.trim().length === 0) {
      errors.push('URL must be a valid non-empty string');
    }
  }

  if (media !== undefined) {
    if (!Array.isArray(media) && typeof media !== 'string') {
      errors.push('Media must be a string or an array of strings');
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(400, errors.join('. ')));
  }

  next();
};

// ─── Pagination Validator ──────────────────────────────────────────────────────
const validatePaginationQuery = (req, res, next) => {
  let { page, limit } = req.query;

  if (page !== undefined) {
    page = parseInt(page, 10);
    if (isNaN(page) || page < 1) {
      return next(new ApiError(400, 'Page must be a positive integer'));
    }
  }

  if (limit !== undefined) {
    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit < 1) {
      return next(new ApiError(400, 'Limit must be a positive integer'));
    }
    if (limit > 50) {
      return next(new ApiError(400, 'Limit cannot exceed 50'));
    }
  }

  next();
};

// ─── Search Validator ──────────────────────────────────────────────────────────
const validateSearchQuery = (req, res, next) => {
  const { q } = req.query;

  if (q !== undefined) {
    if (typeof q !== 'string') {
      return next(new ApiError(400, 'Search query must be a string'));
    }
    if (q.trim().length > 200) {
      return next(new ApiError(400, 'Search query cannot exceed 200 characters'));
    }
  }

  next();
};

module.exports = {
  validateCreatePost,
  validateUpdatePost,
  validatePaginationQuery,
  validateSearchQuery,
};
