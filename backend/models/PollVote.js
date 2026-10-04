const mongoose = require('mongoose');

const pollVoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    optionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: a user can vote at most once per poll post
pollVoteSchema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model('PollVote', pollVoteSchema);
