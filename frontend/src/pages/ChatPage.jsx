import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket, usePresence, useTyping } from '../context/SocketContext';
import { listConversations, getMessages, sendMessage, deleteMessage } from '../api/chatApi';
import { ConversationSkeleton, MessageSkeleton } from '../components/Skeleton';

const CONVS_CACHE_KEY_PREFIX = 'uniconnect_cached_convs_';
const MSGS_CACHE_KEY_PREFIX = 'uniconnect_cached_msgs_';
const WINDOW_PAGE_SIZE = 60;

// ─── 1. Memoized Message Row Component ──────────────────────────────────────────
export const MessageRow = React.memo(
  function MessageRow({ msg, isMine, onRetry, onDelete }) {
    const status = msg.status || (msg.isRead ? 'read' : 'delivered');
    const isFailed = status === 'failed';
    const isSending = status === 'sending';
    const rowKey = msg.clientMsgId || msg._id;

    return (
      <div
        key={rowKey}
        className={`message-bubble ${isMine ? 'mine' : 'other'}${isSending ? ' pending' : ''}${isFailed ? ' failed' : ''}`}
      >
        <div>{msg.content}</div>
        <div className="msg-meta-row">
          <div className="msg-status-indicator">
            {isSending ? (
              <span>🕒 Sending...</span>
            ) : isFailed ? (
              <span>
                ⚠️ Undelivered
                <button type="button" className="msg-retry-btn" onClick={() => onRetry(msg)}>
                  Retry
                </button>
              </span>
            ) : (
              <span>
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}

            {/* Status Ticks for outgoing messages */}
            {isMine && !isSending && !isFailed && (
              <span
                className={`msg-tick${status === 'read' ? ' read' : ''}`}
                title={status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent'}
              >
                {status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : '✓'}
              </span>
            )}
          </div>

          {isMine && !isSending && (
            <button
              type="button"
              onClick={() => onDelete(msg._id)}
              style={{
                border: 'none',
                background: 'none',
                color: isMine ? 'rgba(255,255,255,0.6)' : '#aa2d00',
                padding: 0,
                textDecoration: 'underline',
                fontSize: '9px',
                marginLeft: '10px',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.msg._id === next.msg._id &&
    prev.msg.clientMsgId === next.msg.clientMsgId &&
    prev.msg.content === next.msg.content &&
    prev.msg.status === next.msg.status &&
    prev.msg.isRead === next.msg.isRead &&
    prev.msg.createdAt === next.msg.createdAt &&
    prev.isMine === next.isMine &&
    prev.onRetry === next.onRetry &&
    prev.onDelete === next.onDelete
);

// ─── 2. Isolated Conversation List Item (Subscribes to Presence) ───────────────
const ConversationListItem = React.memo(function ConversationListItem({
  conv,
  isActive,
  partnerId,
  partnerUsername,
  onSelect,
}) {
  const { onlineUsers } = usePresence();
  const isOnline = Boolean(partnerId && onlineUsers.includes(partnerId));

  return (
    <div
      className={`conversation-item${isActive ? ' active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="conversation-item-name">u/{partnerUsername?.replace('u/', '')}</span>
        {isOnline && <span style={{ fontSize: '10px', color: '#090' }}>● online</span>}
      </div>
      <div className="conversation-item-preview">
        {conv.lastMessage?.content || '(no messages)'}
      </div>
    </div>
  );
});

// ─── 3. Isolated Partner Online Badge (Subscribes to Presence) ─────────────────
const ChatPartnerStatus = React.memo(function ChatPartnerStatus({ partnerId }) {
  const { onlineUsers } = usePresence();
  const isOnline = Boolean(partnerId && onlineUsers.includes(partnerId));

  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 'normal',
        color: isOnline ? '#090' : '#888',
      }}
    >
      ({isOnline ? 'Online' : 'Offline'})
    </span>
  );
});

// ─── 4. Isolated Typing Indicator Slot (Subscribes to Typing) ───────────────────
const ChatTypingSlot = React.memo(function ChatTypingSlot({
  conversationId,
  partnerId,
  partnerUsername,
}) {
  const { typingUsers } = useTyping();
  const isTyping = Boolean(conversationId && partnerId && typingUsers[conversationId]?.[partnerId]);

  return (
    <div className="chat-typing-slot" aria-live="polite">
      {isTyping ? `${partnerUsername || 'User'} is typing...` : ''}
    </div>
  );
});

// ─── 5. Isolated Input Component (Keystrokes Do Not Re-render Messages) ────────
const ChatInput = React.memo(function ChatInput({
  conversationId,
  onSend,
  onTypingStart,
  onTypingStop,
}) {
  const [text, setText] = useState('');
  const typingTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    setText(e.target.value);
    if (onTypingStart) onTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop(conversationId);
    }, 1500);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !conversationId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (onTypingStop) onTypingStop(conversationId);

    setText('');
    onSend(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input-area">
      <input
        type="text"
        value={text}
        onChange={handleInputChange}
        placeholder="Type a message..."
        maxLength={2000}
        required
        aria-label="Message input"
        autoComplete="off"
      />
      <button type="submit" className="chat-send-btn" disabled={!text.trim()}>
        Send
      </button>
    </form>
  );
});

// ─── Main ChatPage Component ───────────────────────────────────────────────────
export const ChatPage = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const {
    socket,
    socketStatus,
    joinConversation,
    leaveConversation,
    emitSendMessage,
    emitTypingStart,
    emitTypingStop,
    emitBatchRead,
    emitMessageDelivered,
  } = useSocket();
  const navigate = useNavigate();

  const convsCacheKey = user?._id ? `${CONVS_CACHE_KEY_PREFIX}${user._id}` : null;
  const msgsCacheKey = conversationId ? `${MSGS_CACHE_KEY_PREFIX}${conversationId}` : null;

  // ─── 1. Preload Conversations from LocalStorage Cache ─────────────────────────
  const [conversations, setConversations] = useState(() => {
    if (!convsCacheKey) return [];
    try {
      const cached = localStorage.getItem(convsCacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // ─── 2. Preload Message History from LocalStorage Cache ───────────────────────
  const [messages, setMessages] = useState(() => {
    if (!msgsCacheKey) return [];
    try {
      const cached = localStorage.getItem(msgsCacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [loadingConvs, setLoadingConvs] = useState(() => conversations.length === 0);
  const [loadingMsgs, setLoadingMsgs] = useState(() => messages.length === 0);
  const [isRefreshingMsgs, setIsRefreshingMsgs] = useState(false);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(WINDOW_PAGE_SIZE);

  // Mobile navigation: 'list' | 'window'
  const [mobileView, setMobileView] = useState(conversationId ? 'window' : 'list');

  // Auto-scroll tracking
  const [showNewMsgBtn, setShowNewMsgBtn] = useState(false);
  const isNearBottom = useRef(true);

  const messageEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const scrollSnapshotRef = useRef(null);

  // Bursty socket events batching queue (rAF)
  const incomingQueueRef = useRef([]);
  const rafIdRef = useRef(null);

  // ─── Batch Flushing via requestAnimationFrame ────────────────────────────────
  const flushIncomingQueue = useCallback(() => {
    rafIdRef.current = null;
    const batch = incomingQueueRef.current;
    if (batch.length === 0) return;
    incomingQueueRef.current = [];

    setMessages((prev) => {
      let next = [...prev];
      for (const newMsg of batch) {
        // 1. Check if already present by exact _id
        const existsById = next.some((m) => m._id === newMsg._id);
        if (existsById) continue;

        // 2. Check if there's a pending client message with matching clientMsgId or tempId
        const targetId = newMsg.clientMsgId || newMsg.tempId;
        if (targetId) {
          const tempIdx = next.findIndex(
            (m) => m.clientMsgId === targetId || m.tempId === targetId || m._id === targetId
          );
          if (tempIdx !== -1) {
            next[tempIdx] = {
              ...next[tempIdx],
              ...newMsg,
              clientMsgId: next[tempIdx].clientMsgId || newMsg.clientMsgId,
              _id: newMsg._id,
              status: newMsg.status || 'sent',
            };
            continue;
          }
        }

        next.push({ ...newMsg, status: newMsg.status || 'delivered' });
      }
      return next;
    });
  }, []);

  const queueIncomingMessage = useCallback(
    (newMsg) => {
      incomingQueueRef.current.push(newMsg);
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(flushIncomingQueue);
      }
    },
    [flushIncomingQueue]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // ─── Fetch Conversations with Background Refresh ────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await listConversations();
      const convList = res.data?.conversations || [];
      setConversations(convList);
      if (convsCacheKey) {
        try {
          localStorage.setItem(convsCacheKey, JSON.stringify(convList));
        } catch (_) {}
      }
    } catch (err) {
      console.error('[ChatPage] Failed to load conversations:', err.message);
    } finally {
      setLoadingConvs(false);
    }
  }, [convsCacheKey]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ─── Fetch Message History with Local Cache Display ──────────────────────────
  useEffect(() => {
    if (!conversationId) return;

    setMobileView('window');
    setVisibleCount(WINDOW_PAGE_SIZE);

    // If cache already has messages, don't show blank loading screen
    let hasLocalCache = false;
    try {
      const cached = localStorage.getItem(`${MSGS_CACHE_KEY_PREFIX}${conversationId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setLoadingMsgs(false);
          hasLocalCache = true;
        }
      }
    } catch (_) {}

    if (!hasLocalCache) {
      setLoadingMsgs(true);
    }
    setIsRefreshingMsgs(true);
    setError('');

    const fetchMsgs = async () => {
      try {
        const res = await getMessages(conversationId, { limit: 50 });
        const serverMsgs = (res.data?.messages || []).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );

        setMessages((prev) => {
          // Index existing messages by _id and clientMsgId to preserve stable clientMsgId keys
          const existingMap = new Map();
          for (const m of prev) {
            if (m._id) existingMap.set(m._id, m);
            if (m.clientMsgId) existingMap.set(m.clientMsgId, m);
          }

          // Normalize server messages with delivered / read status and preserve stable clientMsgId
          const normalizedServer = serverMsgs.map((m) => {
            const existing =
              existingMap.get(m._id) || (m.clientMsgId && existingMap.get(m.clientMsgId));
            const senderId = m.sender?._id || m.sender;
            const isMine = senderId === user?._id || senderId?.toString?.() === user?._id;
            return {
              ...m,
              clientMsgId: m.clientMsgId || existing?.clientMsgId || m._id,
              status: isMine ? (m.isRead ? 'read' : 'delivered') : 'delivered',
            };
          });

          // Retain any pending messages that are not yet persisted
          const serverIdSet = new Set(serverMsgs.map((m) => m._id));
          const serverClientSet = new Set(serverMsgs.map((m) => m.clientMsgId).filter(Boolean));

          const pendingMine = prev.filter((m) => {
            const isPendingState = m.status === 'sending' || m.status === 'failed';
            const alreadyInServer = serverIdSet.has(m._id) || serverClientSet.has(m.clientMsgId);
            return isPendingState && !alreadyInServer;
          });

          const merged = [...normalizedServer, ...pendingMine];

          // Persist latest 50 messages to local cache
          try {
            localStorage.setItem(
              `${MSGS_CACHE_KEY_PREFIX}${conversationId}`,
              JSON.stringify(normalizedServer.slice(-50))
            );
          } catch (_) {}

          return merged;
        });

        // Join socket room
        joinConversation(conversationId);

        // Mark latest unread message from peer as read
        const lastPeerMsg = [...serverMsgs].reverse().find((m) => {
          const sId = m.sender?._id || m.sender;
          return sId !== user?._id && sId?.toString?.() !== user?._id;
        });
        if (lastPeerMsg) {
          emitBatchRead(conversationId, lastPeerMsg._id);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load messages');
      } finally {
        setLoadingMsgs(false);
        setIsRefreshingMsgs(false);
      }
    };

    fetchMsgs();

    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId, user?._id, joinConversation, leaveConversation, emitBatchRead]);

  // ─── Socket Event Handlers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // A. Incoming new message
    const handleIncomingMessage = (data) => {
      if (!data?._id) return;
      const msgConvId = data.conversation?.toString?.() || data.conversation;
      if (msgConvId === conversationId) {
        const senderId = data.sender?._id || data.sender;
        const isFromMe = senderId === user?._id || senderId?.toString?.() === user?._id;

        queueIncomingMessage(data);

        if (!isFromMe) {
          emitMessageDelivered(conversationId, data._id, data.clientMsgId);
          emitBatchRead(conversationId, data._id);
        }

        // Auto-scroll if near bottom
        if (isNearBottom.current) {
          setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } else {
          setShowNewMsgBtn(true);
        }
      }

      // Refresh conversations list to update preview and order
      fetchConversations();
    };

    // B. Delivery Ack: Move status from sending/sent -> delivered
    const handleMessageDelivered = ({ conversationId: cId, messageId, clientMsgId }) => {
      if (cId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => {
          const match = m._id === messageId || (clientMsgId && m.clientMsgId === clientMsgId);
          if (match && (m.status === 'sending' || m.status === 'sent')) {
            return { ...m, status: 'delivered' };
          }
          return m;
        })
      );
    };

    // C. Batch Read Receipts: Move delivered -> read
    const handleMessagesRead = ({ conversationId: cId, lastReadMessageId, readerId }) => {
      if (cId !== conversationId || readerId === user?._id) return;
      setMessages((prev) => {
        const target = prev.find((m) => m._id === lastReadMessageId);
        const targetDate = target ? new Date(target.createdAt) : new Date();

        return prev.map((m) => {
          const senderId = m.sender?._id || m.sender;
          const isMine = senderId === user?._id || senderId?.toString?.() === user?._id;
          if (isMine && new Date(m.createdAt) <= targetDate) {
            return { ...m, status: 'read', isRead: true };
          }
          return m;
        });
      });
    };

    // D. Single message read backwards compatibility
    const handleSingleMessageRead = ({ conversationId: cId, messageId, readerId }) => {
      if (cId !== conversationId || readerId === user?._id) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status: 'read', isRead: true } : m))
      );
    };

    // E. Message persist failure notification (Q0.4: recipient drops speculative bubble, sender marks failed)
    const handleMessageFailed = ({ clientMsgId, messageId }) => {
      setMessages((prev) =>
        prev.flatMap((m) => {
          const match = m._id === messageId || (clientMsgId && m.clientMsgId === clientMsgId);
          if (!match) return [m];
          const senderId = m.sender?._id || m.sender;
          const isMine = senderId === user?._id || senderId?.toString?.() === user?._id;
          if (isMine) {
            return [{ ...m, status: 'failed' }];
          }
          return [];
        })
      );
    };

    socket.on('new_message', handleIncomingMessage);
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_read', handleSingleMessageRead);
    socket.on('message_failed', handleMessageFailed);

    return () => {
      socket.off('new_message', handleIncomingMessage);
      socket.off('message_delivered', handleMessageDelivered);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_read', handleSingleMessageRead);
      socket.off('message_failed', handleMessageFailed);
    };
  }, [
    socket,
    conversationId,
    user?._id,
    queueIncomingMessage,
    fetchConversations,
    emitMessageDelivered,
    emitBatchRead,
  ]);

  // Re-join conversation after reconnect
  useEffect(() => {
    if (socketStatus === 'connected' && conversationId) {
      joinConversation(conversationId);
    }
  }, [socketStatus, conversationId, joinConversation]);

  // Auto-scroll on initial message render
  useEffect(() => {
    if (!loadingMsgs && messages.length > 0 && isNearBottom.current) {
      messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loadingMsgs, messages.length]);

  // Track scroll position: stick to bottom only when within ~80px of it
  const handleScroll = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isNearBottom.current = atBottom;
    if (atBottom) setShowNewMsgBtn(false);
  }, []);

  // Real-time polling sync fallback when WebSocket is offline or reconnecting
  useEffect(() => {
    if (!conversationId || socketStatus === 'connected') return;

    const syncInterval = setInterval(async () => {
      try {
        const res = await getMessages(conversationId, { limit: 30 });
        const incoming = res?.data?.messages || [];
        if (incoming.length > 0) {
          setMessages((prev) => {
            const existingMap = new Map();
            prev.forEach((m) => {
              if (m._id) existingMap.set(m._id, m);
              if (m.clientMsgId) existingMap.set(m.clientMsgId, m);
            });

            let added = false;
            const updated = [...prev];

            incoming.forEach((inc) => {
              const match =
                existingMap.get(inc._id) || (inc.clientMsgId && existingMap.get(inc.clientMsgId));
              if (!match) {
                updated.push(inc);
                added = true;
              }
            });

            return added ? updated : prev;
          });
        }
      } catch (err) {
        // silent sync catch
      }
    }, 3500);

    return () => clearInterval(syncInterval);
  }, [conversationId, socketStatus]);

  // ─── Optimistic Send with Immediate HTTP Confirmation ───────────────────────
  const handleSend = useCallback(
    async (messageContent) => {
      if (!messageContent || !conversationId) return;

      // Generate unique clientMsgId for idempotency and optimistic UI
      const clientMsgId = `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const optimisticMsg = {
        _id: clientMsgId,
        clientMsgId,
        tempId: clientMsgId,
        conversation: conversationId,
        sender: { _id: user._id, username: user.username },
        content: messageContent,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

      try {
        // Direct reliable HTTP send to live Atlas database
        const res = await sendMessage(conversationId, messageContent);
        const savedMsg = res?.data?.message || res?.data;

        // Immediately update optimistic bubble to sent
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === clientMsgId || m._id === clientMsgId
              ? {
                  ...m,
                  status: 'sent',
                  _id: savedMsg?._id || m._id,
                  createdAt: savedMsg?.createdAt || m.createdAt,
                  clientMsgId,
                }
              : m
          )
        );

        // Also broadcast via socket if peer socket is active
        if (socket?.connected) {
          socket.emit('send_message', { conversationId, content: messageContent, clientMsgId });
        }
      } catch (err) {
        console.error('[ChatPage] Send failed:', err.message);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === clientMsgId || m._id === clientMsgId ? { ...m, status: 'failed' } : m
          )
        );
      }
    },
    [conversationId, user?._id, user?.username, socket]
  );

  // ─── Retry Failed Message ────────────────────────────────────────────────────
  const handleRetry = useCallback(
    async (msg) => {
      if (!msg || !conversationId) return;

      setMessages((prev) => prev.map((m) => (m._id === msg._id ? { ...m, status: 'sending' } : m)));

      try {
        const res = await sendMessage(conversationId, msg.content);
        const savedMsg = res?.data?.message || res?.data;

        setMessages((prev) =>
          prev.map((m) =>
            m._id === msg._id ? { ...m, status: 'sent', _id: savedMsg?._id || m._id } : m
          )
        );

        if (socket?.connected) {
          socket.emit('send_message', { conversationId, content: msg.content, clientMsgId: msg.clientMsgId });
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m._id === msg._id ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [conversationId, socket]
  );

  // ─── Delete Message ──────────────────────────────────────────────────────────
  const handleDeleteMsg = useCallback(async (msgId) => {
    if (msgId.startsWith('cmsg_') || msgId.startsWith('temp-')) return;
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteMessage(msgId);
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }, []);

  const getPartnerInfo = useCallback(
    (conv) => {
      if (!conv || !conv.participants) return { username: 'deleted', _id: '' };
      return conv.participants.find((p) => p._id !== user?._id) || { username: 'deleted', _id: '' };
    },
    [user?._id]
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === conversationId),
    [conversations, conversationId]
  );

  const partner = useMemo(
    () => getPartnerInfo(activeConversation),
    [getPartnerInfo, activeConversation]
  );

  const handleMobileBack = useCallback(() => {
    setMobileView('list');
    navigate('/chat');
  }, [navigate]);

  // ─── Virtualized / Windowed Slice of Messages ───────────────────────────────
  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleCount) return messages;
    return messages.slice(-visibleCount);
  }, [messages, visibleCount]);

  const hasEarlierMessages = messages.length > visibleCount;

  const handleLoadEarlier = useCallback(() => {
    const el = chatMessagesRef.current;
    if (el) {
      scrollSnapshotRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
    }
    setVisibleCount((prev) => prev + WINDOW_PAGE_SIZE);
  }, []);

  // Preserve scroll position when prepending older pages (scrollHeight delta)
  useLayoutEffect(() => {
    if (scrollSnapshotRef.current && chatMessagesRef.current) {
      const el = chatMessagesRef.current;
      const delta = el.scrollHeight - scrollSnapshotRef.current.scrollHeight;
      if (delta > 0) {
        el.scrollTop = scrollSnapshotRef.current.scrollTop + delta;
      }
      scrollSnapshotRef.current = null;
    }
  }, [visibleCount]);

  const renderReconnectBanner = () => {
    return null;
  };

  return (
    <div className="chat-page-wrapper">
      <div className="chat-grid" data-mobile-view={mobileView}>
        {/* ─── Left Pane: Conversations List ─────────────────────────────── */}
        <div className="conversation-list">
          <div className="conversation-list-header">Conversations</div>

          {loadingConvs ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </div>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => {
              const p = getPartnerInfo(conv);
              return (
                <ConversationListItem
                  key={conv._id}
                  conv={conv}
                  isActive={conv._id === conversationId}
                  partnerId={p._id}
                  partnerUsername={p.username}
                  onSelect={() => navigate(`/chat/${conv._id}`)}
                />
              );
            })
          ) : (
            <div style={{ padding: '15px', fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
              No chat history. Message users from their public profiles to start chat!
            </div>
          )}
        </div>

        {/* ─── Right Pane: Message Area ──────────────────────────────────── */}
        <div className="chat-window">
          {conversationId ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <button
                  type="button"
                  className="chat-back-btn"
                  onClick={handleMobileBack}
                  aria-label="Back to conversations"
                >
                  ‹
                </button>
                <div
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeConversation ? (
                    <>
                      u/{partner.username?.replace('u/', '')}{' '}
                      <ChatPartnerStatus partnerId={partner._id} />
                      {isRefreshingMsgs && (
                        <span className="chat-window-cache-badge">· syncing...</span>
                      )}
                    </>
                  ) : (
                    'Loading...'
                  )}
                </div>
              </div>

              {/* Reconnect Banner */}
              {renderReconnectBanner()}

              {/* Message List */}
              <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScroll}>
                {hasEarlierMessages && (
                  <button
                    type="button"
                    className="chat-load-earlier-btn"
                    onClick={handleLoadEarlier}
                  >
                    ↑ Load earlier messages ({messages.length - visibleCount} more)
                  </button>
                )}

                {loadingMsgs ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <MessageSkeleton isMine={false} />
                    <MessageSkeleton isMine={true} />
                    <MessageSkeleton isMine={false} />
                    <MessageSkeleton isMine={true} />
                  </div>
                ) : error ? (
                  <div className="error-indicator">{error}</div>
                ) : visibleMessages.length > 0 ? (
                  visibleMessages.map((msg) => {
                    const senderId = msg.sender?._id || msg.sender;
                    const isMine = senderId === user?._id || senderId?.toString?.() === user?._id;
                    const rowKey = msg.clientMsgId || msg._id;

                    return (
                      <MessageRow
                        key={rowKey}
                        msg={msg}
                        isMine={isMine}
                        onRetry={handleRetry}
                        onDelete={handleDeleteMsg}
                      />
                    );
                  })
                ) : (
                  <div
                    style={{
                      margin: 'auto',
                      textAlign: 'center',
                      color: '#888',
                      fontStyle: 'italic',
                      fontSize: '12px',
                    }}
                  >
                    Say hello to u/{partner.username?.replace('u/', '')}!
                  </div>
                )}

                {/* Reserved Line for Typing Indicator (Isolated Component) */}
                <ChatTypingSlot
                  conversationId={conversationId}
                  partnerId={partner._id}
                  partnerUsername={partner.username?.replace('u/', '')}
                />

                <div ref={messageEndRef} className="chat-scroll-anchor" />
              </div>

              {/* Floating New Messages Pill when scrolled up */}
              {showNewMsgBtn && (
                <button
                  type="button"
                  className="chat-new-messages-btn"
                  onClick={() => {
                    isNearBottom.current = true;
                    setShowNewMsgBtn(false);
                    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  aria-label="Scroll to new messages"
                >
                  ↓ New messages
                </button>
              )}

              {/* Isolated Message Input Bar */}
              <ChatInput
                conversationId={conversationId}
                onSend={handleSend}
                onTypingStart={emitTypingStart}
                onTypingStop={emitTypingStop}
              />
            </>
          ) : (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#888',
                fontSize: '13px',
                padding: '20px',
              }}
            >
              ◀ Select a conversation to start direct messaging
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .chat-grid[data-mobile-view="list"] .chat-window {
            display: none;
          }
          .chat-grid[data-mobile-view="window"] .conversation-list {
            display: none;
          }
          .chat-grid[data-mobile-view="window"] .chat-window {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatPage;
