const ApiError = require('../utils/ApiError');

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * Validate profile update fields.
 * Only checks fields that are actually provided (partial update).
 */
const validateUpdateProfile = (req, res, next) => {
  const { username, bio, department, year, interests } = req.body;
  const errors = [];

  if (username !== undefined) {
    if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
      errors.push('Username must be between 3 and 30 characters');
    } else if (!USERNAME_REGEX.test(username.trim())) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string' || bio.length > 500) {
      errors.push('Bio cannot exceed 500 characters');
    }
  }

  if (department !== undefined) {
    if (typeof department !== 'string' || department.length > 100) {
      errors.push('Department cannot exceed 100 characters');
    }
  }

  if (year !== undefined) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1 || y > 6) {
      errors.push('Year must be a number between 1 and 6');
    }
  }

  if (interests !== undefined) {
    if (!Array.isArray(interests)) {
      errors.push('Interests must be an array');
    } else if (interests.length > 20) {
      errors.push('Cannot have more than 20 interests');
    } else if (interests.some((i) => typeof i !== 'string' || i.length > 50)) {
      errors.push('Each interest must be a string under 50 characters');
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(400, errors.join('. ')));
  }

  next();
};

module.exports = { validateUpdateProfile };
