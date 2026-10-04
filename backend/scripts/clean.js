/**
 * UniConnect Database Clean Script
 * Drops the MongoDB database to clear all data, collections, and indexes.
 * Run with: node scripts/clean.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

const clean = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Error: This script cannot be run in production!');
    process.exit(1);
  }
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  console.log('🗑️ Dropping database ' + mongoose.connection.db.databaseName + '...');
  await mongoose.connection.db.dropDatabase();
  console.log('🗑️ Database dropped successfully!');

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
  process.exit(0);
};

clean().catch((err) => {
  console.error('❌ Clean failed:', err.message);
  process.exit(1);
});
