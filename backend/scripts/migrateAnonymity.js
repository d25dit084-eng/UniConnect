/**
 * Idempotent Migration: Add isAnonymous field and indexes to Post and Comment
 *
 * Sets default isAnonymous = false on any documents where it is missing,
 * and ensures compound indexes { author: 1, isAnonymous: 1 } are built.
 *
 * Run with: node scripts/migrateAnonymity.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

const migrate = async () => {
  console.log('================================================================');
  console.log('🔄 MIGRATION: Initialize isAnonymous on Posts & Comments');
  console.log('================================================================\n');

  console.log('1. Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('   ✅ Connected to MongoDB.');

  console.log('2. Migrating Posts collection...');
  const postResult = await Post.updateMany(
    { isAnonymous: { $exists: false } },
    { $set: { isAnonymous: false } }
  );
  console.log(`   ✅ Posts migrated: ${postResult.modifiedCount} updated (matched ${postResult.matchedCount})`);

  console.log('3. Migrating Comments collection...');
  const commentResult = await Comment.updateMany(
    { isAnonymous: { $exists: false } },
    { $set: { isAnonymous: false } }
  );
  console.log(`   ✅ Comments migrated: ${commentResult.modifiedCount} updated (matched ${commentResult.matchedCount})`);

  console.log('4. Syncing indexes for Post and Comment...');
  await Post.syncIndexes();
  await Comment.syncIndexes();
  console.log('   ✅ Indexes { author: 1, isAnonymous: 1 } synced successfully.');

  console.log('\n================================================================');
  console.log('🎉 ANONYMITY MIGRATION COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
};

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
