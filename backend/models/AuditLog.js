const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['reveal_anonymous_author', 'delete_post', 'delete_comment', 'ban_user', 'review_report'],
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ['post', 'comment', 'user'],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'A reason is mandatory for admin audit accountability'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters long'],
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    revealedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
