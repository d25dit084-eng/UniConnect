const ApiError = require('../utils/ApiError');

/**
 * Zod validation middleware generator.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - The request property to validate (default: 'body')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed; // Replace with sanitized/coerced values
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const issues = err.issues || err.errors || [];
        const formattedErrors = issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        const summary = formattedErrors.map((e) => `${e.field}: ${e.message}`).join(', ');
        return next(new ApiError(400, `Validation failed: ${summary}`, formattedErrors));
      }
      next(err);
    }
  };
};

module.exports = validate;
