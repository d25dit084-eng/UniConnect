import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { listConversations, getMessages, deleteMessage } from '../api/chatApi';

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
    emitMessageRead,
  } = useSocket();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState('');
  // Mobile: 'list' | 'window'
  const [mobileView, setMobileView] = useState(conversationId ? 'window' : 'list');
  // Auto-scroll: track if user is near bottom
  const [showNewMsgBtn, setShowNewMsgBtn] = useState(false);
  const isNearBottom = useRef(true);

  const typingTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // ─── Deduplication helper ──────────────────────────────────────────────────
  const addMessageDeduped = useCallback((newMsg) => {
    setMessages((prev) => {
      // Check if already exists by _id
      const existsById = prev.some((m) => m._id === newMsg._id);
      if (existsById) return prev;

      // Check if there's a pending temp message with matching tempId
      if (newMsg.tempId) {
        const tempIdx = prev.findIndex((m) => m._id === newMsg.tempId);
        if (tempIdx !== -1) {
          // Replace the optimistic message with the confirmed one
          const next = [...prev];
          next[tempIdx] = { ...newMsg, _id: newMsg._id };
          return next;
        }
      }
      return [...prev, newMsg];
    });
  }, []);

  // ─── Fetch conversations list ──────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await listConversations();
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('[ChatPage] Failed to load conversations:', err.message);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ─── Fetch message history when conversationId changes ────────────────────
  useEffect(() => {
    if (!conversationId) return;

    setMobileView('window');

    const fetchMsgs = async () => {
      setLoadingMsgs(true);
      setError('');
      try {
        const res = await getMessages(conversationId, 1, 50);
        const sorted = (res.data.messages || []).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        setMessages(sorted);
        joinConversation(conversationId);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load messages');
      } finally {
        setLoadingMsgs(false);
      }
    };

    fetchMsgs();

    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId, joinConversation, leaveConversation]);

  // ─── Socket: incoming new_message ─────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      // data is now the full message object (not wrapped in { message: ... })
      if (!data?._id) return;
      const msgConvId = data.conversation?.toString?.() || data.conversation;
      if (msgConvId === conversationId) {
        addMessageDeduped(data);
        // Auto-scroll if near bottom
        if (isNearBottom.current) {
          setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } else {
          setShowNewMsgBtn(true);
        }
      }
      // Refresh conversation list to update lastMessage preview
      fetchConversations();
    };

    socket.on('new_message', handleIncomingMessage);
    return () => {
      socket.off('new_message', handleIncomingMessage);
    };
  }, [socket, conversationId, addMessageDeduped, fetchConversations]);

  // ─── Re-join conversation after reconnect ──────────────────────────────────
  useEffect(() => {
    if (socketStatus === 'connected' && conversationId) {
      joinConversation(conversationId);
    }
  }, [socketStatus, conversationId, joinConversation]);

  // ─── Scroll behaviour ──────────────────────────────────────────────────────
  // Scroll to bottom when messages first load
  useEffect(() => {
    if (!loadingMsgs && messages.length > 0) {
      messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isNearBottom.current = true;
    }
  }, [loadingMsgs]);

  // Track scroll position to decide whether to auto-scroll
  const handleScroll = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const threshold = 80; // px from bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isNearBottom.current = atBottom;
    if (atBottom) setShowNewMsgBtn(false);
  }, []);

  // ─── Typing debounce ───────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setText(e.target.value);
    emitTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId);
    }, 1500);
  };

  // ─── Send message via Socket (optimistic) ─────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      emitTypingStop(conversationId);
    }

    const messageContent = text.trim();
    setText('');

    if (socketStatus === 'connected') {
      // OPTIMISTIC: show immediately with a temp ID
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMsg = {
        _id: tempId,
        tempId,
        conversation: conversationId,
        sender: { _id: user._id, username: user.username },
        content: messageContent,
        createdAt: new Date().toISOString(),
        _pending: true,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // Emit via socket — server will broadcast new_message back to room
      // We pass the same tempId so we can dedup when server echoes it back
      if (socket) {
        socket.emit('send_message', { conversationId, content: messageContent, tempId });
      }
    } else {
      // Fallback: REST API if socket not connected
      try {
        const { sendMessage } = await import('../api/chatApi');
        const res = await sendMessage(conversationId, messageContent);
        addMessageDeduped(res.data.message);
        fetchConversations();
      } catch (err) {
        alert(`Send failed: ${err.response?.data?.message || err.message}`);
        setText(messageContent); // restore text on failure
      }
    }
  };

  const handleDeleteMsg = async (msgId) => {
    if (msgId.startsWith('temp-')) return; // can't delete unsent
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
    return conv.participants.find((p) => p._id !== user._id) || { username: 'deleted', _id: '' };
  };

  const activeConversation = conversations.find((c) => c._id === conversationId);
  const partner = getPartnerInfo(activeConversation);
  const isPartnerOnline = onlineUsers.includes(partner._id);

  // Typing: get usernames of people typing in this conversation (excluding self)
  const typingInThisConv = typingUsers[conversationId] || {};
  const otherTypingUsernames = Object.entries(typingInThisConv)
    .filter(([uid]) => uid !== user?._id)
    .map(([, uname]) => uname);
  const isTyping = otherTypingUsernames.length > 0;

  // Handle mobile back button
  const handleMobileBack = () => {
    setMobileView('list');
    navigate('/chat');
  };

  // ─── Reconnect notification ────────────────────────────────────────────────
  const renderReconnectBanner = () => {
    if (socketStatus === 'reconnecting') {
      return <div className="chat-reconnect-banner">🔄 Reconnecting...</div>;
    }
    if (socketStatus === 'disconnected') {
      return <div className="chat-reconnect-banner">⚠️ Connection lost. Messages may be delayed.</div>;
    }
    return null;
  };

  return (
    <div className="chat-page-wrapper">
      <div
        className="chat-grid"
        data-mobile-view={mobileView}
      >
        {/* ─── Left Pane: Conversations List ─────────────────────────────── */}
        <div
          className="conversation-list"
          style={{
            // On mobile: hide when window is open
            display: undefined,
          }}
        >
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
              {/* Chat header */}
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
                    </>
                  ) : (
                    'Loading...'
                  )}
                </div>
              </div>

              {/* Reconnect banner */}
              {renderReconnectBanner()}

              {/* Messages */}
              <div
                className="chat-messages"
                ref={chatMessagesRef}
                onScroll={handleScroll}
              >
                {loadingMsgs ? (
                  <div className="loading-indicator">Loading message history...</div>
                ) : error ? (
                  <div className="error-indicator">{error}</div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const senderId = msg.sender?._id || msg.sender;
                    const isMine = senderId === user._id || senderId?.toString?.() === user._id;
                    const isPending = msg._pending === true;
                    const isFailed = msg._failed === true;
                    return (
                      <div
                        key={msg._id}
                        className={`message-bubble ${isMine ? 'mine' : 'other'}${isPending ? ' pending' : ''}${isFailed ? ' failed' : ''}`}
                      >
                        <div>{msg.content}</div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '9px',
                            color: isMine ? 'rgba(255,255,255,0.6)' : '#888',
                            marginTop: '4px',
                          }}
                        >
                          <span>
                            {isPending
                              ? '⏳ Sending...'
                              : isFailed
                              ? '❌ Failed'
                              : new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                          </span>
                          {isMine && !isPending && (
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
                                minHeight: 'auto',
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

                {/* Typing indicator */}
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

              {/* New messages button */}
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

              {/* Message input */}
              <form onSubmit={handleSend} className="chat-input-area">
                <input
                  type="text"
                  value={text}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
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

      {/* Mobile CSS: show only active panel */}
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
