const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

function shouldLog(level) {
  if (isTest && !process.env.DEBUG) return false;
  return (LOG_LEVELS[level] ?? 1) >= (LOG_LEVELS[currentLevel] ?? 1);
}

function formatOutput(level, message, meta = {}) {
  const timestamp = new Date().toISOString();

  if (isProduction) {
    // In production, emit single-line structured JSON
    const logObj = {
      timestamp,
      level,
      message,
      ...meta,
    };
    if (meta.error instanceof Error) {
      logObj.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        name: meta.error.name,
      };
    }
    return JSON.stringify(logObj);
  }

  // In development, emit clear formatted terminal logs
  const colorMap = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const color = colorMap[level] || reset;
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}${metaStr}`;
}

const logger = {
  debug(message, meta) {
    if (shouldLog('debug')) {
      console.debug(formatOutput('debug', message, meta));
    }
  },
  info(message, meta) {
    if (shouldLog('info')) {
      console.log(formatOutput('info', message, meta));
    }
  },
  warn(message, meta) {
    if (shouldLog('warn')) {
      console.warn(formatOutput('warn', message, meta));
    }
  },
  error(message, meta) {
    if (shouldLog('error')) {
      console.error(formatOutput('error', message, meta));
    }
  },
  http(meta) {
    if (shouldLog('info')) {
      const msg = `${meta.method} ${meta.url} ${meta.status} ${meta.durationMs}ms`;
      console.log(formatOutput('info', msg, meta));
    }
  },
};

module.exports = logger;
