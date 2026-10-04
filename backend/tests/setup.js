const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_12345678901234567890123456789012';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_12345678901234567890123456789012';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_12345678901234567890123456789012';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

// Safety check
const parsed = new URL(MONGO_URI.startsWith('mongodb://') || MONGO_URI.startsWith('mongodb+srv://') ? MONGO_URI : `mongodb://${MONGO_URI}`);
if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
  throw new Error(`ABORT: Safety check failed. Tests must only run against localhost / dev database. Host: ${parsed.hostname}`);
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
