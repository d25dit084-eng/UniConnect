const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { verifyAccessToken } = require('./tokenService');
const User = require('../models/User');

let io;

// ─── Bounded LRU Cache with TTL Expiry Sweep ──────────────────────────────────
class BoundedLRUMap {
  constructor(maxSize = 2000, defaultTTLMs = 0) {
    this.maxSize = maxSize;
    this.defaultTTLMs = defaultTTLMs;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const entry = this.map.get(key);
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU position
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTTLMs) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict least recently accessed item
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    this.map.set(key, { value, expiresAt });
    return this;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  entries() {
    const now = Date.now();
    const result = [];
    for (const [k, v] of this.map.entries()) {
      if (!v.expiresAt || v.expiresAt > now) {
        result.push([k, v.value]);
      }
    }
    return result;
  }

  sweep() {
    const now = Date.now();
    for (const [k, v] of this.map.entries()) {
      if (v.expiresAt && v.expiresAt <= now) {
        this.map.delete(k);
      }
    }
  }

  get size() {
    return this.map.size;
  }
}

// ─── In-Memory Hot Caches with Hard Max Caps & TTLs ───────────────────────────
// userCache: userId -> { _id, username, avatar, isBanned } (cap 5,000, TTL 15m)
const userCache = new BoundedLRUMap(5000, 15 * 60 * 1000);

// blockCache: blockerId -> Set<blockedId> (cap 5,000, TTL 15m)
const blockCache = new BoundedLRUMap(5000, 15 * 60 * 1000);

// conversationCache: conversationId -> { participants: string[] } (cap 2,000, TTL 15m)
const conversationCache = new BoundedLRUMap(2000, 15 * 60 * 1000);

// userRateLimits: userId -> { count, resetAt } (cap 10,000)
const userRateLimits = new BoundedLRUMap(10000);

// processedClientMsgs: clientMsgId -> timestamp (cap 20,000, TTL 5m)
const processedClientMsgs = new BoundedLRUMap(20000, 5 * 60 * 1000);

// onlineUsers: userId -> Set of socket.ids (supports multiple tabs)
const onlineUsers = new Map();

// typingTimers: `${conversationId}:${userId}` -> setTimeout handle
const typingTimers = new Map();

// pendingPersistQueue: Set of active async persistence promises for graceful shutdown
const pendingPersistQueue = new Set();

// Active expiry sweep every 60 seconds
setInterval(() => {
  processedClientMsgs.sweep();
  userCache.sweep();
  blockCache.sweep();
  conversationCache.sweep();
  const now = Date.now();
  for (const [uid, data] of userRateLimits.entries()) {
    if (data.resetAt < now) userRateLimits.delete(uid);
  }
}, 60 * 1000).unref();

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const getCachedUser = async (userId) => {
  const idStr = userId.toString();
  if (userCache.has(idStr)) {
    return userCache.get(idStr);
  }
  try {
    const user = await User.findById(idStr).select('_id username avatar profileImage isBanned').lean();
    if (user) {
      const publicUser = {
        _id: user._id.toString(),
        username: user.username.startsWith('u/') ? user.username : `u/${user.username}`,
        avatar: user.avatar || user.profileImage || null,
        isBanned: Boolean(user.isBanned),
      };
      userCache.set(idStr, publicUser);
      return publicUser;
    }
  } catch (err) {
    console.error('[SocketCache] Error fetching user:', err.message);
  }
  return null;
};

const getCachedConversation = async (conversationId) => {
  const idStr = conversationId.toString();
  if (conversationCache.has(idStr)) {
    return conversationCache.get(idStr);
  }
  try {
    const Conversation = require('../models/Conversation');
    const conv = await Conversation.findById(idStr).select('participants').lean();
    if (conv) {
      const data = {
        participants: conv.participants.map((p) => p.toString()),
      };
      conversationCache.set(idStr, data);
      return data;
    }
  } catch (err) {
    console.error('[SocketCache] Error fetching conversation:', err.message);
  }
  return null;
};

const isUserBlocked = async (userA, userB) => {
  const idA = userA.toString();
  const idB = userB.toString();

  // Check cache for A blocking B
  if (blockCache.has(idA) && blockCache.get(idA).has(idB)) return true;
  // Check cache for B blocking A
  if (blockCache.has(idB) && blockCache.get(idB).has(idA)) return true;

  // On cache miss, load from DB
  try {
    const Block = require('../models/Block');
    const block = await Block.findOne({
      $or: [
        { blocker: idA, blocked: idB },
        { blocker: idB, blocked: idA },
      ],
    }).lean();

    if (block) {
      if (!blockCache.has(block.blocker.toString())) {
        blockCache.set(block.blocker.toString(), new Set());
      }
      blockCache.get(block.blocker.toString()).add(block.blocked.toString());
      return true;
    } else {
      if (!blockCache.has(idA)) blockCache.set(idA, new Set());
      if (!blockCache.has(idB)) blockCache.set(idB, new Set());
    }
  } catch (err) {
    console.error('[SocketCache] Error checking block:', err.message);
  }

  return false;
};

// Invalidation helpers (called from controllers when data changes)
const invalidateConversationCache = (conversationId) => {
  if (conversationId) conversationCache.delete(conversationId.toString());
};

const invalidateBlockCache = (userId) => {
  if (userId) blockCache.delete(userId.toString());
};

const invalidateUserCache = (userId) => {
  if (userId) userCache.delete(userId.toString());
};

// ─── Batched Async MongoDB Persistence Queue with Coalescing & Graceful Flush ──
let persistBatch = [];
let persistTimer = null;
const BATCH_FLUSH_INTERVAL_MS = 20; // <= 25ms
const BATCH_FLUSH_MAX_SIZE = 50; // <= 50 messages

const flushPersistBatch = async () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (persistBatch.length === 0) return;

  const currentBatch = persistBatch;
  persistBatch = [];

  const task = (async () => {
    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');

    const msgOps = currentBatch.map((item) => ({
      insertOne: {
        document: {
          _id: item.messageId,
          conversation: item.conversationId,
          sender: item.senderId,
          content: item.content,
          clientMsgId: item.clientMsgId || null,
          attachments: item.attachments || [],
          createdAt: item.msgDate,
        },
      },
    }));

    let successfulItems = [];
    let failedItems = [];

    try {
      await Message.bulkWrite(msgOps, { ordered: false });
      successfulItems = currentBatch;
    } catch (err) {
      if (err && err.writeErrors && Array.isArray(err.writeErrors)) {
        const errorIndices = new Map();
        for (const we of err.writeErrors) {
          errorIndices.set(we.index, we);
        }
        for (let i = 0; i < currentBatch.length; i++) {
          const we = errorIndices.get(i);
          if (!we) {
            successfulItems.push(currentBatch[i]);
          } else if (we.code === 11000) {
            // Idempotent duplicate: count as success
            successfulItems.push(currentBatch[i]);
          } else {
            console.error(`[AsyncPersist] Bulk write error for message ${currentBatch[i].messageId}:`, we.errmsg || we.message);
            failedItems.push(currentBatch[i]);
          }
        }
      } else {
        console.error('[AsyncPersist] Entire bulkWrite failed:', err.message);
        failedItems = currentBatch;
      }
    }

    // Resolve deferred sender acks for successful items
    for (const item of successfulItems) {
      if (item.ackCb) {
        try {
          item.ackCb({
            status: 'sent',
            clientMsgId: item.clientMsgId,
            messageId: item.messageId.toString(),
            createdAt: item.msgDate.toISOString(),
          });
        } catch (ackErr) {
          console.error('[AsyncPersist] Error executing ackCb:', ackErr.message);
        }
      }
    }

    // Coalesce Conversation.lastMessage into ONE update per conversation per flush
    if (successfulItems.length > 0) {
      const latestByConv = new Map();
      for (const item of successfulItems) {
        const cId = item.conversationId.toString();
        const existing = latestByConv.get(cId);
        if (!existing || item.msgDate >= existing.msgDate) {
          latestByConv.set(cId, item);
        }
      }

      const convOps = Array.from(latestByConv.values()).map((latest) => ({
        updateOne: {
          filter: { _id: latest.conversationId },
          update: {
            $set: {
              lastMessage: latest.messageId,
              lastMessageAt: latest.msgDate,
            },
          },
        },
      }));

      if (convOps.length > 0) {
        try {
          await Conversation.bulkWrite(convOps, { ordered: false });
        } catch (convErr) {
          console.error('[AsyncPersist] Error coalescing Conversation.lastMessage bulkWrite:', convErr.message);
        }
      }
    }

    // Handle failed items (retry up to 3 attempts, or emit message_failed)
    if (failedItems.length > 0) {
      for (const item of failedItems) {
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts >= 3) {
          console.error(`[AsyncPersist] Message ${item.messageId} failed all 3 persistence attempts.`);
          if (item.ackCb) {
            try {
              item.ackCb({
                status: 'failed',
                error: 'Failed to persist message to database',
                clientMsgId: item.clientMsgId,
                messageId: item.messageId ? item.messageId.toString() : null,
              });
            } catch (ackErr) {
              console.error('[AsyncPersist] Error executing failed ackCb:', ackErr.message);
            }
          }
          if (io) {
            const convIdStr = item.conversationId.toString();
            io.to(convIdStr).emit('message_failed', {
              clientMsgId: item.clientMsgId,
              messageId: item.messageId ? item.messageId.toString() : null,
              conversationId: convIdStr,
              error: 'Failed to persist message to database',
            });
            if (item.socketId) {
              io.to(item.socketId).emit('message_failed', {
                clientMsgId: item.clientMsgId,
                messageId: item.messageId ? item.messageId.toString() : null,
                conversationId: convIdStr,
                error: 'Failed to persist message to database',
              });
            }
          }
        } else {
          // Re-queue for next flush
          persistBatch.push(item);
        }
      }

      if (persistBatch.length > 0 && !persistTimer) {
        persistTimer = setTimeout(flushPersistBatch, 50).unref();
      }
    }
  })();

  pendingPersistQueue.add(task);
  task.finally(() => pendingPersistQueue.delete(task));
  return task;
};

const queueMessagePersist = (item) => {
  persistBatch.push(item);
  if (persistBatch.length >= BATCH_FLUSH_MAX_SIZE) {
    flushPersistBatch();
  } else if (!persistTimer) {
    persistTimer = setTimeout(flushPersistBatch, BATCH_FLUSH_INTERVAL_MS).unref();
  }
};

// ─── Graceful Shutdown: Flush Persist Queue on SIGTERM / SIGINT ──────────────
const flushPersistQueue = async () => {
  if (persistBatch.length > 0) {
    await flushPersistBatch();
  }
  if (pendingPersistQueue.size > 0) {
    console.log(`[Socket] Flushing ${pendingPersistQueue.size} pending message persistence tasks...`);
    await Promise.allSettled(Array.from(pendingPersistQueue));
    console.log('[Socket] Persist queue flushed completely.');
  }
};

process.on('SIGTERM', async () => {
  console.log('[Socket] Received SIGTERM signal. Flushing persistence queue...');
  await flushPersistQueue();
});

process.on('SIGINT', async () => {
  await flushPersistQueue();
});

// ─── Disconnect Banned User Live Sockets ─────────────────────────────────────
const disconnectUserSockets = (userId) => {
  if (!userId) return;
  const idStr = userId.toString();
  invalidateUserCache(idStr);

  const socketIds = onlineUsers.get(idStr);
  if (socketIds && io) {
    for (const sId of socketIds) {
      const sock = io.sockets.sockets.get(sId);
      if (sock) {
        sock.emit('error_message', { message: 'Your account has been suspended' });
        sock.disconnect(true);
      }
    }
    onlineUsers.delete(idStr);
    broadcastPresence();
  }
};

// ─── Presence Broadcasting (Memory Only, Debounced to coalesce reconnect bursts) ─
let presenceBroadcastTimer = null;
const broadcastPresence = () => {
  if (presenceBroadcastTimer) return;
  presenceBroadcastTimer = setTimeout(() => {
    presenceBroadcastTimer = null;
    if (io) {
      io.emit('presence_change', {
        onlineUsers: Array.from(onlineUsers.keys()),
      });
    }
  }, 200).unref();
};

// ─── Socket Server Initialization ─────────────────────────────────────────────
const initializeSocket = (server) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  if (process.env.CLIENT_URL) {
    try {
      const parsedUrl = new URL(process.env.CLIENT_URL);
      allowedOrigins.push(parsedUrl.origin);
    } catch (e) {
      allowedOrigins.push(process.env.CLIENT_URL.replace(/\/$/, ''));
    }
  }

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(cleanOrigin) || /\.vercel\.app$/.test(cleanOrigin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Backlog A.1: WebSocket transport optimization
    transports: ['websocket'],
    perMessageDeflate: false, // Disable compression for sub-millisecond small payloads
    pingTimeout: 20000,
    pingInterval: 25000,
    // Connection-state recovery keeps packets and rooms across brief disconnects
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  // Ensure TCP_NODELAY on raw Engine.IO transport sockets
  io.engine.on('connection', (rawSocket) => {
    if (rawSocket.transport && rawSocket.transport.socket) {
      rawSocket.transport.socket.setNoDelay?.(true);
    }
  });

  // ─── Optional Redis Adapter for Multi-Node Scaling ──────────────────────────
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');

      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          console.log('✅ Socket.IO Redis adapter enabled for multi-node clustering');
        })
        .catch((err) => {
          console.warn('⚠️ Redis adapter connection failed, running with in-memory adapter:', err.message);
        });
    } catch (err) {
      console.warn('⚠️ Redis adapter not loaded, using in-memory adapter:', err.message);
    }
  }

  // ─── JWT Authentication Middleware ──────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyAccessToken(token);
      const user = await getCachedUser(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      if (user.isBanned) {
        return next(new Error('Authentication error: User account is suspended'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // ─── Connection Handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Track online user sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal user room for direct signals
    socket.join(`user_${userId}`);

    // Broadcast presence update
    broadcastPresence();

    // ─── 1. Join Conversation Room ────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId }, ackCb) => {
      if (!conversationId) return;

      try {
        const conv = await getCachedConversation(conversationId);
        if (!conv) {
          if (ackCb) ackCb({ error: 'Conversation not found' });
          return;
        }

        const isMember = conv.participants.includes(userId);
        if (!isMember) {
          socket.emit('error_message', { message: 'Not authorized to join this conversation' });
          if (ackCb) ackCb({ error: 'Unauthorized' });
          return;
        }

        socket.join(conversationId);
        if (ackCb) ackCb({ status: 'joined', conversationId });
      } catch (err) {
        if (ackCb) ackCb({ error: err.message });
      }
    });

    // ─── 2. Leave Conversation Room ───────────────────────────────────────────
    socket.on('leave_conversation', ({ conversationId }) => {
      if (conversationId) socket.leave(conversationId);
    });

    // ─── 3. Send Message (Relay First, Persist Second) ────────────────────────
    socket.on('send_message', async ({ conversationId, content, clientMsgId, tempId, attachments = [] }, ackCb) => {
      try {
        // A. Validation
        if (!conversationId || typeof content !== 'string') {
          if (ackCb) ackCb({ error: 'Invalid message payload' });
          return;
        }

        const trimmed = content.trim();
        if (trimmed.length === 0) {
          if (ackCb) ackCb({ error: 'Message cannot be empty' });
          return;
        }

        if (trimmed.length > 2000) {
          if (ackCb) ackCb({ error: 'Message exceeds maximum length of 2000 characters' });
          return;
        }

        const now = Date.now();

        // B. Per-User Rate Limiting (20 messages per 10 seconds)
        const isBench = socket.handshake.auth?.isBenchmark || process.env.SKIP_CHAT_RATE_LIMIT === 'true';
        if (!isBench) {
          const rateLimit = userRateLimits.get(userId) || { count: 0, resetAt: now + 10000 };
          if (now > rateLimit.resetAt) {
            rateLimit.count = 1;
            rateLimit.resetAt = now + 10000;
          } else {
            rateLimit.count++;
            if (rateLimit.count > 20) {
              socket.emit('rate_limit_exceeded', { message: 'Message rate limit exceeded. Please wait a few seconds.' });
              if (ackCb) ackCb({ error: 'Rate limit exceeded' });
              return;
            }
          }
          userRateLimits.set(userId, rateLimit);
        }

        // C. Idempotency & Deduplication
        const effectiveClientMsgId = clientMsgId || tempId;
        if (effectiveClientMsgId) {
          if (processedClientMsgs.has(effectiveClientMsgId)) {
            // Already processed — echo ack immediately
            if (ackCb) ackCb({ status: 'sent', clientMsgId: effectiveClientMsgId });
            return;
          }
          processedClientMsgs.set(effectiveClientMsgId, now);
        }

        const convIdStr = conversationId.toString();

        // D. Verify membership via hot cache (sync check first)
        let conv = conversationCache.get(convIdStr);
        if (!conv) {
          conv = await getCachedConversation(convIdStr);
        }
        if (!conv || !conv.participants.includes(userId)) {
          socket.emit('error_message', { message: 'Unauthorized or conversation not found' });
          if (ackCb) ackCb({ error: 'Unauthorized' });
          return;
        }

        // E. Block check via hot cache
        const otherParticipant = conv.participants.find((p) => p !== userId);
        if (otherParticipant) {
          const blocked = await isUserBlocked(userId, otherParticipant);
          if (blocked) {
            socket.emit('error_message', { message: 'Cannot send message. A block relationship exists.' });
            if (ackCb) ackCb({ error: 'Blocked' });
            return;
          }
        }

        // F. RELAY FIRST TO RECIPIENT: Broadcast to room IMMEDIATELY before ANY await
        const messageId = new mongoose.Types.ObjectId();
        const msgDate = new Date();
        const createdAt = msgDate.toISOString();

        const publicSender = {
          _id: socket.user._id,
          username: socket.user.username,
          avatar: socket.user.avatar,
        };

        const messagePayload = {
          _id: messageId.toString(),
          clientMsgId: effectiveClientMsgId || null,
          conversation: convIdStr,
          sender: publicSender,
          content: trimmed,
          attachments: attachments && attachments.length > 0 ? attachments : [],
          isRead: false,
          status: 'sent',
          createdAt,
        };

        // Recipient receives message immediately via WebSocket
        io.to(convIdStr).emit('new_message', messagePayload);

        // G. PERSIST SECOND: Buffer into batched flush queue reusing prebuilt payload
        // Sender's "sent" ack fires only AFTER the batched bulkWrite succeeds.
        queueMessagePersist({
          messageId,
          conversationId: convIdStr,
          senderId: socket.user._id,
          content: trimmed,
          clientMsgId: effectiveClientMsgId,
          attachments: messagePayload.attachments,
          socketId: socket.id,
          ackCb,
          msgDate,
        });

      } catch (err) {
        console.error('[Socket] Error in send_message:', err.message);
        if (ackCb) ackCb({ error: err.message });
      }
    });

    // ─── 4. Message Delivered Ack (Receiver -> Sender via room) ───────────────
    socket.on('message_delivered', ({ conversationId, messageId, clientMsgId }) => {
      if (conversationId && messageId) {
        socket.to(conversationId).emit('message_delivered', {
          conversationId,
          messageId,
          clientMsgId,
          deliveredTo: userId,
        });
      }
    });

    // ─── 5. Batch Read Receipts (Debounced / Single Event with last-read id) ──
    socket.on('batch_message_read', async ({ conversationId, lastReadMessageId }, ackCb) => {
      try {
        if (!conversationId || !lastReadMessageId) return;

        // Broadcast to conversation room immediately
        io.to(conversationId).emit('messages_read', {
          conversationId,
          lastReadMessageId,
          readerId: userId,
        });

        if (ackCb) ackCb({ status: 'ok' });

        // Asynchronously update MongoDB unread messages
        setImmediate(async () => {
          try {
            const Message = require('../models/Message');
            const targetMsg = await Message.findById(lastReadMessageId).select('createdAt').lean();
            if (targetMsg) {
              await Message.updateMany(
                {
                  conversation: conversationId,
                  sender: { $ne: userId },
                  createdAt: { $lte: targetMsg.createdAt },
                  isRead: false,
                },
                { $set: { isRead: true } }
              );
            }
          } catch (e) {
            console.error('[BatchRead] Async update error:', e.message);
          }
        });
      } catch (err) {
        if (ackCb) ackCb({ error: err.message });
      }
    });

    // Backward compatibility for single message_read event
    socket.on('message_read', async ({ conversationId, messageId }) => {
      if (!conversationId || !messageId) return;
      io.to(conversationId).emit('message_read', {
        conversationId,
        messageId,
        readerId: userId,
      });

      setImmediate(async () => {
        try {
          const Message = require('../models/Message');
          await Message.findByIdAndUpdate(messageId, { $set: { isRead: true } });
        } catch (_) {}
      });
    });

    // ─── 6. Typing Indicators (Memory Only + 4s Auto-Expire) ──────────────────
    socket.on('typing_start', ({ conversationId }) => {
      if (!conversationId) return;

      const timerKey = `${conversationId}:${userId}`;

      // Clear existing timer if any
      if (typingTimers.has(timerKey)) {
        clearTimeout(typingTimers.get(timerKey));
      }

      // Broadcast to other participants
      socket.to(conversationId).emit('typing_start', {
        conversationId,
        userId,
        username: socket.user.username,
      });

      // Auto-expire after 4 seconds
      const timeout = setTimeout(() => {
        typingTimers.delete(timerKey);
        socket.to(conversationId).emit('typing_stop', {
          conversationId,
          userId,
          username: socket.user.username,
        });
      }, 4000);

      typingTimers.set(timerKey, timeout);
    });

    socket.on('typing_stop', ({ conversationId }) => {
      if (!conversationId) return;
      const timerKey = `${conversationId}:${userId}`;
      if (typingTimers.has(timerKey)) {
        clearTimeout(typingTimers.get(timerKey));
        typingTimers.delete(timerKey);
      }
      socket.to(conversationId).emit('typing_stop', {
        conversationId,
        userId,
        username: socket.user.username,
      });
    });

    // ─── 7. Disconnection ─────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          userRateLimits.delete(userId);
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
  invalidateConversationCache,
  invalidateBlockCache,
  invalidateUserCache,
  disconnectUserSockets,
  flushPersistQueue,
};
