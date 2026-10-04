import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { listConversations, getMessages, deleteMessage } from '../api/chatApi';

const CONVS_CACHE_KEY_PREFIX = 'uniconnect_cached_convs_';
const MSGS_CACHE_KEY_PREFIX = 'uniconnect_cached_msgs_';
const WINDOW_PAGE_SIZE = 60;

export const ChatPage = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const {
    socket,
    socketStatus,
    onlineUsers,
    typingUsers,
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

  const [text, setText] = useState('');
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

  const typingTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // ─── Deduplication Helper ────────────────────────────────────────────────────
  const addMessageDeduped = useCallback((newMsg) => {
    setMessages((prev) => {
      // 1. Check if already present by exact _id
      const existsById = prev.some((m) => m._id === newMsg._id);
      if (existsById) return prev;

      // 2. Check if there's a pending client message with matching clientMsgId or tempId
      const targetId = newMsg.clientMsgId || newMsg.tempId;
      if (targetId) {
        const tempIdx = prev.findIndex(
          (m) => m.clientMsgId === targetId || m.tempId === targetId || m._id === targetId
        );
        if (tempIdx !== -1) {
          const next = [...prev];
          next[tempIdx] = {
            ...next[tempIdx],
            ...newMsg,
            _id: newMsg._id,
            status: newMsg.status || 'sent',
          };
          return next;
        }
      }

      return [...prev, { ...newMsg, status: newMsg.status || 'delivered' }];
    });
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
          // Normalize server messages with delivered / read status
          const normalizedServer = serverMsgs.map((m) => {
            const senderId = m.sender?._id || m.sender;
            const isMine = senderId === user?._id || senderId?.toString?.() === user?._id;
            return {
              ...m,
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
        const lastPeerMsg = [...serverMsgs]
          .reverse()
          .find((m) => {
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

        addMessageDeduped(data);

        if (!isFromMe) {
          // Immediately acknowledge delivery to the room
          emitMessageDelivered(conversationId, data._id, data.clientMsgId);
          // Debounced batch read
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
          // Recipient drops speculative unpersisted bubble
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
    addMessageDeduped,
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

  // Track scroll position to decide whether to auto-scroll
  const handleScroll = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isNearBottom.current = atBottom;
    if (atBottom) setShowNewMsgBtn(false);
  }, []);

  // Typing debounce (Throttled by SocketContext)
  const handleInputChange = (e) => {
    setText(e.target.value);
    emitTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId);
    }, 1500);
  };

  // ─── Optimistic Send with State Progression ──────────────────────────────────
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || !conversationId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      emitTypingStop(conversationId);
    }

    const messageContent = text.trim();
    setText('');

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
      const ack = await emitSendMessage(conversationId, messageContent, clientMsgId);

      if (ack?.status === 'queued_offline') {
        // Enqueued in offline buffer, will auto-flush on reconnect
        return;
      }

      // Update message status to 'sent'
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMsgId === clientMsgId || m._id === clientMsgId
            ? { ...m, status: 'sent', _id: ack?.messageId || m._id }
            : m
        )
      );
    } catch (err) {
      console.error('[ChatPage] Send failed:', err.message);
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMsgId === clientMsgId || m._id === clientMsgId
            ? { ...m, status: 'failed' }
            : m
        )
      );
    }
  };

  // ─── Retry Failed Message ────────────────────────────────────────────────────
  const handleRetry = async (msg) => {
    if (!msg || !conversationId) return;

    // Reset status back to sending
    setMessages((prev) =>
      prev.map((m) => (m._id === msg._id ? { ...m, status: 'sending' } : m))
    );

    try {
      const ack = await emitSendMessage(conversationId, msg.content, msg.clientMsgId || msg._id);
      if (ack?.status === 'queued_offline') return;

      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id
            ? { ...m, status: 'sent', _id: ack?.messageId || m._id }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const handleDeleteMsg = async (msgId) => {
    if (msgId.startsWith('cmsg_') || msgId.startsWith('temp-')) return;
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteMessage(msgId);
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const getPartnerInfo = (conv) => {
    if (!conv || !conv.participants) return { username: 'deleted', _id: '' };
    return conv.participants.find((p) => p._id !== user?._id) || { username: 'deleted', _id: '' };
  };

  const activeConversation = conversations.find((c) => c._id === conversationId);
  const partner = getPartnerInfo(activeConversation);
  const isPartnerOnline = onlineUsers.includes(partner._id);

  // Typing state
  const typingInThisConv = typingUsers[conversationId] || {};
  const otherTypingUsernames = Object.entries(typingInThisConv)
    .filter(([uid]) => uid !== user?._id)
    .map(([, uname]) => uname);
  const isTyping = otherTypingUsernames.length > 0;

  const handleMobileBack = () => {
    setMobileView('list');
    navigate('/chat');
  };

  // ─── Virtualized / Windowed Slice of Messages ───────────────────────────────
  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleCount) return messages;
    return messages.slice(-visibleCount);
  }, [messages, visibleCount]);

  const hasEarlierMessages = messages.length > visibleCount;

  const handleLoadEarlier = () => {
    setVisibleCount((prev) => prev + WINDOW_PAGE_SIZE);
  };

  const renderReconnectBanner = () => {
    if (socketStatus === 'reconnecting') {
      return <div className="chat-reconnect-banner">🔄 Reconnecting to real-time chat...</div>;
    }
    if (socketStatus === 'disconnected') {
      return <div className="chat-reconnect-banner">⚠️ Connection offline. Outgoing messages will auto-send on reconnect.</div>;
    }
    return null;
  };

  return (
    <div className="chat-page-wrapper">
      <div className="chat-grid" data-mobile-view={mobileView}>
        {/* ─── Left Pane: Conversations List ─────────────────────────────── */}
        <div className="conversation-list">
          <div className="conversation-list-header">Conversations</div>

          {loadingConvs ? (
            <div className="loading-indicator">Loading...</div>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => {
              const p = getPartnerInfo(conv);
              const isOnline = onlineUsers.includes(p._id);
              return (
                <div
                  key={conv._id}
                  className={`conversation-item${conv._id === conversationId ? ' active' : ''}`}
                  onClick={() => navigate(`/chat/${conv._id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/chat/${conv._id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="conversation-item-name">u/{p.username?.replace('u/', '')}</span>
                    {isOnline && <span style={{ fontSize: '10px', color: '#090' }}>● online</span>}
                  </div>
                  <div className="conversation-item-preview">
                    {conv.lastMessage?.content || '(no messages)'}
                  </div>
                </div>
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
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeConversation ? (
                    <>
                      u/{partner.username?.replace('u/', '')}{' '}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'normal',
                          color: isPartnerOnline ? '#090' : '#888',
                        }}
                      >
                        ({isPartnerOnline ? 'Online' : 'Offline'})
                      </span>
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
              <div
                className="chat-messages"
                ref={chatMessagesRef}
                onScroll={handleScroll}
              >
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
                  <div className="loading-indicator">Loading message history...</div>
                ) : error ? (
                  <div className="error-indicator">{error}</div>
                ) : visibleMessages.length > 0 ? (
                  visibleMessages.map((msg) => {
                    const senderId = msg.sender?._id || msg.sender;
                    const isMine = senderId === user?._id || senderId?.toString?.() === user?._id;
                    const status = msg.status || (msg.isRead ? 'read' : 'delivered');
                    const isFailed = status === 'failed';
                    const isSending = status === 'sending';

                    return (
                      <div
                        key={msg._id || msg.clientMsgId}
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
                                <button
                                  type="button"
                                  className="msg-retry-btn"
                                  onClick={() => handleRetry(msg)}
                                >
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
                                title={
                                  status === 'read'
                                    ? 'Read'
                                    : status === 'delivered'
                                    ? 'Delivered'
                                    : 'Sent'
                                }
                              >
                                {status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>

                          {isMine && !isSending && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMsg(msg._id)}
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
                  })
                ) : (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: '12px' }}>
                    Say hello to u/{partner.username?.replace('u/', '')}!
                  </div>
                )}

                {/* Typing Indicator */}
                {isTyping && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#777',
                      fontStyle: 'italic',
                      alignSelf: 'flex-start',
                      marginLeft: '5px',
                      padding: '4px 0',
                    }}
                  >
                    {otherTypingUsernames[0]} is typing...
                  </div>
                )}

                <div ref={messageEndRef} />
              </div>

              {/* Jump to New Messages Button */}
              {showNewMsgBtn && (
                <button
                  type="button"
                  className="chat-new-messages-btn"
                  onClick={() => {
                    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setShowNewMsgBtn(false);
                  }}
                >
                  New messages ↓
                </button>
              )}

              {/* Message Input Bar */}
              <form onSubmit={handleSend} className="chat-input-area">
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
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#888', fontSize: '13px', padding: '20px' }}>
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
