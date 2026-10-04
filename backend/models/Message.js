const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content cannot be empty'],
      trim: true,
      maxlength: [2000, 'Message content cannot exceed 2000 characters'],
    },
    clientMsgId: {
      type: String,
      default: null,
      trim: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for cursor pagination & history
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isRead: 1 });
messageSchema.index(
  { sender: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: 'string' } } }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
