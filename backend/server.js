require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const mongoose = require('mongoose');
const { initializeSocket, flushPersistQueue } = require('./services/socketService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB FIRST
  await connectDB();

  const server = http.createServer(app);

  // Enable TCP_NODELAY on all incoming HTTP/WebSocket connections
  server.on('connection', (socket) => {
    socket.setNoDelay(true);
  });

  // Initialize Socket.io server
  initializeSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Health: http://localhost:${PORT}/api/health`);
  });

  const gracefulShutdown = async (signal) => {
    console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await flushPersistQueue();
      } catch (e) {
        console.error('[Server] Error flushing persist queue:', e.message);
      }
      try {
        await mongoose.connection.close();
        console.log('[Server] MongoDB connection closed.');
      } catch (e) {
        console.error('[Server] Error closing MongoDB:', e.message);
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();
