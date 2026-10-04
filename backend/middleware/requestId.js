const crypto = require('crypto');

/**
 * Assigns a unique X-Request-Id header to incoming requests
 * for end-to-end tracing and observability across logs and errors.
 */
function requestIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

module.exports = requestIdMiddleware;
