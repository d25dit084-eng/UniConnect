/**
 * Safe Demo Data Cleanup Script
 * Clears only demo/test data seeded by development scripts, preserving other user data.
 * Run with: node scripts/removeDemoData.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Block = require('../models/Block');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

const demoUsernames = [
  'quietfalcon', 'quietowl', 'bytefox', 'randompixel',
  'anonymous_42', 'nightshift', 'voidwalker', 'sysadm', 'admin_uc'
];

const demoEmails = [
  'falcon@college.edu', 'owl@college.edu', 'fox@college.edu', 'pixel@college.edu',
  'anon42@college.edu', 'shift@college.edu', 'void@college.edu', 'admin@college.edu',
  'admin@uniconnect.edu'
];

const demoCommunitySlugs = ['chaos', 'play-round'];

const cleanup = async () => {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  // Find demo users
  const demoUsers = await User.find({
    $or: [
      { username: { $in: demoUsernames } },
      { email: { $in: demoEmails } },
      { username: { $regex: /^user[a-c]_/i } },
      { email: { $regex: /^user[a-c]_/i } }
    ]
  });
  const demoUserIds = demoUsers.map(u => u._id);
  console.log(`Found ${demoUserIds.length} demo/test users in the database.`);

  // Find demo communities
  const demoCommunities = await Community.find({
    $or: [
      { slug: { $in: demoCommunitySlugs } },
      { slug: { $regex: /^programming_/i } }
    ]
  });
  const demoCommunityIds = demoCommunities.map(c => c._id);
  console.log(`Found ${demoCommunityIds.length} demo/test communities.`);

  // Find demo posts (either written by a demo user or posted in a demo community)
  const demoPosts = await Post.find({
    $or: [
      { author: { $in: demoUserIds } },
      { community: { $in: demoCommunityIds } }
    ]
  });
  const demoPostIds = demoPosts.map(p => p._id);
  console.log(`Found ${demoPostIds.length} demo posts.`);

  // Find demo comments (either written by a demo user or posted on a demo post)
  const demoComments = await Comment.find({
    $or: [
      { author: { $in: demoUserIds } },
      { post: { $in: demoPostIds } }
    ]
  });
  const demoCommentIds = demoComments.map(c => c._id);
  console.log(`Found ${demoCommentIds.length} demo comments.`);

  // 1. Delete comments
  const deletedComments = await Comment.deleteMany({ _id: { $in: demoCommentIds } });
  console.log(`Deleted ${deletedComments.deletedCount} comments.`);

  // 2. Delete posts
  const deletedPosts = await Post.deleteMany({ _id: { $in: demoPostIds } });
  console.log(`Deleted ${deletedPosts.deletedCount} posts.`);

  // 3. Delete community memberships for demo communities OR demo users
  const deletedMemberships = await CommunityMember.deleteMany({
    $or: [
      { community: { $in: demoCommunityIds } },
      { user: { $in: demoUserIds } }
    ]
  });
  console.log(`Deleted ${deletedMemberships.deletedCount} community memberships.`);

  // 4. Delete communities
  const deletedCommunities = await Community.deleteMany({ _id: { $in: demoCommunityIds } });
  console.log(`Deleted ${deletedCommunities.deletedCount} communities.`);

  // 5. Delete votes for demo posts, demo comments, or by demo users
  const deletedVotes = await Vote.deleteMany({
    $or: [
      { voter: { $in: demoUserIds } },
      { targetId: { $in: [...demoPostIds, ...demoCommentIds] } }
    ]
  });
  console.log(`Deleted ${deletedVotes.deletedCount} votes.`);

  // 6. Delete saved posts for demo posts or by demo users
  const deletedSavedPosts = await SavedPost.deleteMany({
    $or: [
      { user: { $in: demoUserIds } },
      { post: { $in: demoPostIds } }
    ]
  });
  console.log(`Deleted ${deletedSavedPosts.deletedCount} saved posts.`);

  // Find conversations involving any demo user
  const demoConversations = await Conversation.find({
    participants: { $in: demoUserIds }
  });
  const demoConversationIds = demoConversations.map(c => c._id);

  // 7. Delete messages in those conversations or sent by demo users
  const deletedMessages = await Message.deleteMany({
    $or: [
      { sender: { $in: demoUserIds } },
      { conversation: { $in: demoConversationIds } }
    ]
  });
  console.log(`Deleted ${deletedMessages.deletedCount} messages.`);

  // 8. Delete conversations
  const deletedConversations = await Conversation.deleteMany({ _id: { $in: demoConversationIds } });
  console.log(`Deleted ${deletedConversations.deletedCount} conversations.`);

  // Delete notifications sent to or triggered by demo users
  const deletedNotifications = await Notification.deleteMany({
    recipient: { $in: demoUserIds }
  });
  console.log(`Deleted ${deletedNotifications.deletedCount} notifications.`);

  // Delete reports made by demo users or reporting demo posts/comments
  const deletedReports = await Report.deleteMany({
    $or: [
      { reporter: { $in: demoUserIds } },
      { targetId: { $in: [...demoPostIds, ...demoCommentIds] } }
    ]
  });
  console.log(`Deleted ${deletedReports.deletedCount} reports.`);

  // Delete blocks involving demo users
  const deletedBlocks = await Block.deleteMany({
    $or: [
      { blocker: { $in: demoUserIds } },
      { blocked: { $in: demoUserIds } }
    ]
  });
  console.log(`Deleted ${deletedBlocks.deletedCount} blocks.`);

  // Delete refresh tokens for demo users
  const deletedRefreshTokens = await RefreshToken.deleteMany({
    user: { $in: demoUserIds }
  });
  console.log(`Deleted ${deletedRefreshTokens.deletedCount} refresh tokens.`);

  // 9. Delete users
  const deletedUsersCount = await User.deleteMany({ _id: { $in: demoUserIds } });
  console.log(`Deleted ${deletedUsersCount.deletedCount} demo users.`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
  process.exit(0);
};

cleanup().catch((err) => {
  console.error('❌ Cleanup failed:', err.message);
  process.exit(1);
});
