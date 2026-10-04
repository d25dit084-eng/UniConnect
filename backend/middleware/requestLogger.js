const logger = require('../utils/logger');

/**
 * Middleware measuring HTTP request execution duration and logging structured telemetry.
 */
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number((end - start) / 1000000n);

    // Omit noisy health check polling from verbose logs in production
    if (req.originalUrl === '/api/health' && durationMs < 50) {
      return;
    }

    logger.http({
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
    });
  });

  next();
}

module.exports = requestLogger;
