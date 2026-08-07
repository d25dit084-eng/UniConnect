const mongoose = require('mongoose');

const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'misinformation',
  'inappropriate',
  'privacy',
  'other',
];
const REPORT_STATUSES = ['pending', 'reviewed', 'dismissed', 'actioned'];
const TARGET_TYPES = ['post', 'comment', 'community', 'user', 'message'];

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      default: null,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
    },
    // Admin / Moderator fields
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    moderationNote: {
      type: String,
      default: '',
      maxlength: [500, 'Moderation note cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 });
reportSchema.index({ community: 1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
