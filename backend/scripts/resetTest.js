require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Like = require('../models/Like');
  const SavedPost = require('../models/SavedPost');
  const Notification = require('../models/Notification');
  const Post = require('../models/Post');
  const Comment = require('../models/Comment');
  await Like.deleteMany({});
  await SavedPost.deleteMany({});
  await Notification.deleteMany({});
  await Post.updateMany({}, { $set: { likeCount: 0, saveCount: 0 } });
  await Comment.updateMany({}, { $set: { likeCount: 0 } });
  console.log('Cleared: likes, saves, notifications; reset counters');
  await mongoose.disconnect();
  process.exit(0);
});

