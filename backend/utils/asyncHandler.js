/**
 * Wraps an async route handler and forwards any errors to Express's next().
 * Eliminates the need for try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
