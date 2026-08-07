const mongoose = require('mongoose');

const savedPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index — one save per user per post
savedPostSchema.index({ user: 1, post: 1 }, { unique: true });
savedPostSchema.index({ user: 1, createdAt: -1 }); // For listing saved posts by user

const SavedPost = mongoose.model('SavedPost', savedPostSchema);

module.exports = SavedPost;
