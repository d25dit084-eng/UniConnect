const ApiError = require('../utils/ApiError');

/**
 * Role-based authorization middleware factory.
 * Usage: router.delete('/admin/users', protect, authorize('admin'), handler)
 *
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied. Required role: ${roles.join(' or ')}.`)
      );
    }

    next();
  };
};

module.exports = { authorize };
