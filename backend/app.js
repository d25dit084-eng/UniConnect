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

const app = express();

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Static Files (uploaded images) ──────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = dbStatusMap[dbState] || 'unknown';

  res.json({
    success: true,
    server: 'running',
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`,
  });
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

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
});

// ─── Central Error Handler (must be last) ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
