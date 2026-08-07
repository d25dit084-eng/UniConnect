const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Middleware to validate that a route parameter is a valid MongoDB ObjectId.
 * Prevents Mongoose CastError and confusing 500 errors when an invalid id is passed.
 *
 * Usage: router.get('/:id', validateObjectId('id'), handler)
 *
 * @param {string} paramName - Name of the route param to validate (default: 'id')
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, `Invalid ${paramName}: '${id}' is not a valid ID.`));
    }
    next();
  };
};

module.exports = validateObjectId;
