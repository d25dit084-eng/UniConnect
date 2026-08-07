const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Community name is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Community name must be at least 3 characters'],
      maxlength: [30, 'Community name cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Community name can only contain letters, numbers, underscores, and hyphens'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    icon: {
      type: String,
      default: null,
    },
    banner: {
      type: String,
      default: null,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    membersCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    postsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    visibility: {
      type: String,
      enum: ['public', 'restricted', 'private'],
      default: 'public',
    },
    rules: [
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
      },
    ],
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

communitySchema.index({ visibility: 1 });

const Community = mongoose.model('Community', communitySchema);

module.exports = Community;
