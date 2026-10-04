const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');

const errorHandler = require('./middleware/errorMiddleware');
const ApiError = require('./utils/ApiError');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const savedPostRoutes = require('./routes/savedPostRoutes');
const communityRoutes = require('./routes/communityRoutes');
const voteRoutes = require('./routes/voteRoutes');
const feedRoutes = require('./routes/feedRoutes');
const chatRoutes = require('./routes/chatRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

const helmet = require('helmet');
const { generalLimiter } = require('./middleware/rateLimiter');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// ─── Request Identification & Structured Telemetry ────────────────────────────
app.use(requestId);
app.use(requestLogger);

// ─── Security Headers (Helmet) ───────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows uploaded images to be loaded by frontend
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

if (process.env.CLIENT_URL) {
  try {
    const parsedUrl = new URL(process.env.CLIENT_URL);
    allowedOrigins.push(parsedUrl.origin);
  } catch (e) {
    allowedOrigins.push(process.env.CLIENT_URL.replace(/\/$/, ''));
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(cleanOrigin) || /\.vercel\.app$/.test(cleanOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use('/api', generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Static Files (uploaded images) ──────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { getEventLoopStats } = require('./utils/eventLoopMonitor');

// ─── Health Check with Dependency Monitoring ──────────────────────────────
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = dbStatusMap[dbState] || 'unknown';
  const eventLoop = getEventLoopStats();

  let dbLatencyMs = null;
  let isDbHealthy = false;

  if (dbState === 1 && mongoose.connection.db) {
    try {
      const dbStart = process.hrtime.bigint();
      await mongoose.connection.db.admin().ping();
      const dbEnd = process.hrtime.bigint();
      dbLatencyMs = Number((dbEnd - dbStart) / 1000000n);
      isDbHealthy = true;
    } catch {
      isDbHealthy = false;
    }
  }

  const mem = process.memoryUsage();
  const memoryStats = {
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
  };

  const isHealthy = isDbHealthy || dbState === 1;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'degraded',
    server: isHealthy ? 'running' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`,
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    },
    memory: memoryStats,
    eventLoop: {
      p99LagMs: eventLoop.p99LagMs,
      p95LagMs: eventLoop.p95LagMs,
      p50LagMs: eventLoop.p50LagMs,
      maxLagMs: eventLoop.maxLagMs,
      meanLagMs: eventLoop.meanLagMs,
    },
    dependencies: {
      database: {
        status: isDbHealthy ? 'healthy' : 'unhealthy',
        type: 'mongodb',
        readyState: dbStatus,
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: process.env.REDIS_URL ? 'configured' : 'in-memory-fallback',
        type: process.env.REDIS_URL ? 'redis-cluster' : 'local-memory',
      },
    },
  });
});

app.post('/api/health/reset-eventloop', (req, res) => {
  const { histogram } = require('./utils/eventLoopMonitor');
  histogram.reset();
  res.json({ success: true, message: 'Event loop histogram reset' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/saved', savedPostRoutes);
app.use('/api/saved-posts', savedPostRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', reviewRoutes);

// ─── API Documentation (OpenAPI 3.0 / Swagger UI) ───────────────────────────
app.get('/api/docs/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

const swaggerCsp = (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  next();
};

app.use(
  '/api/docs',
  swaggerCsp,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'UniConnect API Documentation',
  })
);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
});

// ─── Central Error Handler (must be last) ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
