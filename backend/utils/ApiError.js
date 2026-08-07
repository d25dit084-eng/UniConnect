/**
 * Custom API Error class.
 * Extends the native Error to carry an HTTP status code.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // Marks expected, handled errors
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
