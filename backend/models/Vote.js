const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType',
    },
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can vote on a specific post or comment only once
voteSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
voteSchema.index({ targetType: 1, targetId: 1 });

const Vote = mongoose.model('Vote', voteSchema);

module.exports = Vote;
