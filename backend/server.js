require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const { initializeSocket } = require('./services/socketService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB FIRST
  await connectDB();

  const server = http.createServer(app);

  // Initialize Socket.io server
  initializeSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Health: http://localhost:${PORT}/api/health`);
  });
};

startServer();
