const { Server } = require('socket.io');
const { verifyAccessToken } = require('./tokenService');
const User = require('../models/User');

let io;
const onlineUsers = new Map(); // userId -> Set of socket.ids (support multiple tabs)

/**
 * Broadcast full online user list to all connected sockets.
 * Emits: { onlineUsers: string[] } — array of user ID strings
 */
const broadcastPresence = () => {
  if (io) {
    io.emit('presence_change', {
      onlineUsers: Array.from(onlineUsers.keys()),
    });
  }
};

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Ping settings for lower latency detection
    pingTimeout: 10000,
    pingInterval: 25000,
  });

  // ─── JWT Authentication middleware for sockets ─────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // ─── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Track online — support multiple tabs per user (Set of socket IDs)
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room for direct events
    socket.join(userId);

    // Broadcast updated presence to everyone
    broadcastPresence();

    // ─── Join conversation room ──────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId }) => {
      if (!conversationId) return;

      // Verify membership before joining room
      try {
        const Conversation = require('../models/Conversation');
        const conv = await Conversation.findById(conversationId).select('participants');
        if (!conv) return;
        const isMember = conv.participants.map((p) => p.toString()).includes(userId);
        if (!isMember) {
          return socket.emit('error_message', { message: 'Not authorized to join this conversation' });
        }
        socket.join(conversationId);
      } catch (err) {
        // Silently ignore — socket rooms are not critical auth path
      }
    });

    // ─── Leave conversation room ─────────────────────────────────────────────
    socket.on('leave_conversation', ({ conversationId }) => {
      if (conversationId) socket.leave(conversationId);
    });

    // ─── Real-time message sending ───────────────────────────────────────────
    // Client emits: { conversationId, content, tempId? }
    // Server broadcasts: full message object to conversationId room
    socket.on('send_message', async ({ conversationId, content, tempId, attachments = [] }) => {
      try {
        if (!conversationId || !content?.trim()) return;

        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');

        const conversation = await Conversation.findById(conversationId);
        if (
          !conversation ||
          !conversation.participants.map((p) => p.toString()).includes(userId)
        ) {
          return socket.emit('error_message', { message: 'Unauthorized or conversation not found' });
        }

        // Persist message to MongoDB
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content: content.trim(),
          attachments,
        });

        // Update conversation's lastMessage
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        const publicSender = {
          _id: socket.user._id,
          username: socket.user.username.startsWith('u/')
            ? socket.user.username
            : `u/${socket.user.username}`,
          avatar: socket.user.avatar || socket.user.profileImage || null,
        };

        const responseMessage = {
          _id: message._id.toString(),
          tempId: tempId || null, // echo back tempId for optimistic UI dedup
          conversation: message.conversation.toString(),
          sender: publicSender,
          content: message.content,
          attachments: message.attachments,
          isRead: message.isRead,
          createdAt: message.createdAt,
        };

        // Emit new_message to all participants in the room (including sender)
        io.to(conversationId).emit('new_message', responseMessage);
      } catch (err) {
        socket.emit('error_message', { message: 'Failed to send message: ' + err.message });
      }
    });

    // ─── Typing indicators ───────────────────────────────────────────────────
    // Broadcast to OTHER participants in the room (not the sender)
    socket.on('typing_start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(conversationId).emit('typing_start', {
          conversationId,
          userId,
          username: socket.user.username.startsWith('u/')
            ? socket.user.username
            : `u/${socket.user.username}`,
        });
      }
    });

    socket.on('typing_stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(conversationId).emit('typing_stop', {
          conversationId,
          userId,
          username: socket.user.username.startsWith('u/')
            ? socket.user.username
            : `u/${socket.user.username}`,
        });
      }
    });

    // ─── Message read receipt ────────────────────────────────────────────────
    socket.on('message_read', async ({ conversationId, messageId }) => {
      try {
        const Message = require('../models/Message');
        const msg = await Message.findById(messageId);
        if (
          msg &&
          msg.conversation.toString() === conversationId &&
          msg.sender.toString() !== userId
        ) {
          msg.isRead = true;
          await msg.save();
          io.to(conversationId).emit('message_read', {
            conversationId,
            messageId,
            readerId: userId,
          });
        }
      } catch (err) {
        // Background event — silently ignore errors
      }
    });

    // ─── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          // User has no more active connections
          onlineUsers.delete(userId);
        }
      }
      broadcastPresence();
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io has not been initialized');
  return io;
};

/**
 * Broadcasts a new post event to all active sockets
 */
const broadcastNewPost = (post) => {
  if (io) {
    io.emit('new_post', {
      _id: post._id,
      title: post.title,
      community: post.community,
      createdAt: post.createdAt,
    });
  }
};

const getOnlineStatus = (userId) => {
  return onlineUsers.has(userId.toString()) ? 'online' : 'offline';
};

module.exports = {
  initializeSocket,
  getIO,
  broadcastNewPost,
  getOnlineStatus,
};
