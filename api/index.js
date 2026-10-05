const mongoose = require('mongoose');
const app = require('../backend/app');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState >= 1) {
    return;
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[API] MONGO_URI is not set!');
    return;
  }
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('[API] MongoDB connected successfully');
  } catch (err) {
    console.error('[API] MongoDB connection error:', err.message);
  }
};

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
