const mongoose = require('mongoose');

const communityMemberSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'owner'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a user can join a community only once
communityMemberSchema.index({ community: 1, user: 1 }, { unique: true });
communityMemberSchema.index({ user: 1 });

const CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);

module.exports = CommunityMember;
