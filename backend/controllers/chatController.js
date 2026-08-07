const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Block = require('../models/Block');
const { getIO } = require('../services/socketService');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');

// Helper to clean up "u/" prefix from username input
const cleanUsername = (username) => {
  if (typeof username !== 'string') return '';
  return username.trim().startsWith('u/') ? username.trim().substring(2) : username.trim();
};

// ─── Create Conversation ───────────────────────────────────────────────────────
const createConversation = asyncHandler(async (req, res) => {
  const { recipientUsername } = req.body;
  const senderId = req.user._id;

  const targetUsername = cleanUsername(recipientUsername);

  const recipient = await User.findOne({
    username: { $regex: new RegExp(`^${targetUsername}$`, 'i') },
  });

  if (!recipient) {
    throw new ApiError(404, 'Recipient user not found');
  }

  const recipientId = recipient._id;

  if (senderId.toString() === recipientId.toString()) {
    throw new ApiError(400, 'You cannot start a conversation with yourself');
  }

  // Check if either user blocks the other
  const isBlocked = await Block.findOne({
    $or: [
      { blocker: senderId, blocked: recipientId },
      { blocker: recipientId, blocked: senderId },
    ],
  });

  if (isBlocked) {
    throw new ApiError(403, 'Cannot start conversation. A block relationship exists between you.');
  }

  // Check if recipient allows direct messages
  // (Assuming allowDirectMessages defaults to true in User schema settings, checked during profile retrieval)
  if (recipient.allowDirectMessages === false) {
    throw new ApiError(403, 'This user does not accept direct messages');
  }

  // Check if duplicate DM conversation already exists
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, recipientId], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, recipientId],
      lastMessageAt: new Date(),
    });
  }

  sendResponse(res, 201, 'Conversation initialized successfully', { conversation });
});

// ─── List Conversations ────────────────────────────────────────────────────────
const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const conversations = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate({
      path: 'participants',
      select: 'username avatar bio karma',
    })
    .populate({
      path: 'lastMessage',
      select: 'content sender isRead createdAt',
    });

  const total = await Conversation.countDocuments({ participants: userId });

  // Format usernames to u/username in output
  const responseData = conversations.map((conv) => {
    const obj = conv.toObject();
    obj.participants = obj.participants.map((p) => {
      p.username = p.username.startsWith('u/') ? p.username : `u/${p.username}`;
      p.avatar = p.avatar || p.profileImage || null;
      return p;
    });
    return obj;
  });

  sendResponse(res, 200, 'Conversations retrieved successfully', {
    conversations: responseData,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Get Conversation Messages ─────────────────────────────────────────────────
const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { page = 1, limit = 50 } = req.query;

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Prevent IDOR: Check if logged-in user is a participant
  if (!conversation.participants.map((p) => p.toString()).includes(userId.toString())) {
    throw new ApiError(403, 'You do not have access to this conversation');
  }

  const skip = (Number(page) - 1) * Number(limit);

  const messages = await Message.find({ conversation: id })
    .sort({ createdAt: -1 }) // Sort newest first for pagination, client can reverse
    .skip(skip)
    .limit(Number(limit))
    .populate('sender', 'username avatar');

  const total = await Message.countDocuments({ conversation: id });

  // Format usernames to u/username in sender info
  const responseData = messages.map((m) => {
    const obj = m.toObject();
    if (obj.sender) {
      obj.sender.username = obj.sender.username.startsWith('u/') ? obj.sender.username : `u/${obj.sender.username}`;
      obj.sender.avatar = obj.sender.avatar || obj.sender.profileImage || null;
    }
    return obj;
  });

  sendResponse(res, 200, 'Messages retrieved successfully', {
    messages: responseData,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── Send Message (HTTP Endpoint fallback / alternative) ───────────────────────
const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, attachments } = req.body;
  const userId = req.user._id;

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Prevent IDOR
  if (!conversation.participants.map((p) => p.toString()).includes(userId.toString())) {
    throw new ApiError(403, 'You do not have access to this conversation');
  }

  // Check blocks before sending
  const otherParticipant = conversation.participants.find((p) => p.toString() !== userId.toString());
  const isBlocked = await Block.findOne({
    $or: [
      { blocker: userId, blocked: otherParticipant },
      { blocker: otherParticipant, blocked: userId },
    ],
  });

  if (isBlocked) {
    throw new ApiError(403, 'Cannot send message. A block relationship exists.');
  }

  const message = await Message.create({
    conversation: id,
    sender: userId,
    content: content.trim(),
    attachments: attachments || [],
  });

  // Update conversation
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  // Emits real-time notification/message via socket.io
  try {
    const io = getIO();
    const publicSender = {
      _id: req.user._id,
      username: req.user.username.startsWith('u/') ? req.user.username : `u/${req.user.username}`,
      avatar: req.user.avatar || req.user.profileImage,
    };
    
    const socketMsg = {
      _id: message._id,
      conversation: message.conversation,
      sender: publicSender,
      content: message.content,
      attachments: message.attachments,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
    
    io.to(id).emit('new_message', socketMsg);
  } catch (err) {
    // If socket.io is not active or fails, message is still saved in DB
  }

  sendResponse(res, 201, 'Message sent successfully', { message });
});

// ─── Mark Message as Read ──────────────────────────────────────────────────────
const readMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(id).populate('conversation');
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  // Verify participant
  if (!message.conversation.participants.map((p) => p.toString()).includes(userId.toString())) {
    throw new ApiError(403, 'You do not have access to this message');
  }

  // Cannot mark own messages as read
  if (message.sender.toString() === userId.toString()) {
    throw new ApiError(400, 'Cannot read your own message');
  }

  message.isRead = true;
  await message.save();

  try {
    const io = getIO();
    io.to(message.conversation._id.toString()).emit('message_read', {
      conversationId: message.conversation._id.toString(),
      messageId: message._id,
      readerId: userId,
    });
  } catch (err) {
    // Silently proceed
  }

  sendResponse(res, 200, 'Message marked as read');
});

// ─── Delete Message ────────────────────────────────────────────────────────────
const deleteMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(id);
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  // Only the sender can delete their message
  if (message.sender.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only delete your own messages');
  }

  await Message.deleteOne({ _id: id });

  sendResponse(res, 200, 'Message deleted successfully');
});

module.exports = {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
  readMessage,
  deleteMessage,
};
