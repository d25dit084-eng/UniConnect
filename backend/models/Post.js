const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: [true, 'Post must belong to a community'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'link'],
      default: 'text',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters'],
      // Required if type is 'text' (handled in validator / pre-save)
    },
    url: {
      type: String,
      trim: true,
      // Required if type is 'link'
    },
    media: {
      type: [String],
      default: [],
      // Required if type is 'image'
    },
    upvoteCount: {
      type: Number,
      default: 1, // Author automatically upvotes their own post
      min: 0,
    },
    downvoteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    score: {
      type: Number,
      default: 1, // score = upvoteCount - downvoteCount
    },
    hotRank: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    saveCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'hidden', 'removed'],
      default: 'active',
    },
    edited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Text index for search
postSchema.index({ title: 'text', content: 'text' });
postSchema.index({ author: 1 });
postSchema.index({ community: 1, createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ hotRank: -1 });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
