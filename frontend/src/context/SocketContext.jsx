import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const PresenceContext = createContext(null);
const TypingContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]); // array of userId strings
  const [typingUsers, setTypingUsers] = useState({}); // conversationId -> { userId: username }
  const [socketStatus, setSocketStatus] = useState('disconnected'); // 'connected'|'disconnected'|'reconnecting'

  const socketRef = useRef(null);
  const offlineQueueRef = useRef([]); // { conversationId, content, clientMsgId, resolve, reject }
  const lastTypingSentRef = useRef({}); // conversationId -> timestamp (throttle 2s)
  const batchReadTimeoutRef = useRef({}); // conversationId -> timer

  useEffect(() => {
    // Cleanup previous socket if token changes
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setSocketStatus('disconnected');
    }

    if (!accessToken) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    // Backlog A.1: WebSocket transport only, skipping HTTP long-polling upgrade
    const newSocket = io(socketUrl, {
      auth: (cb) => {
        cb({
          token: localStorage.getItem('accessToken') || accessToken,
        });
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000, // Exponential backoff max 5s
      randomizationFactor: 0.5, // Random jitter (+/- 50%) to prevent reconnect storms
      timeout: 10000,
    });

    socketRef.current = newSocket;

    // ─── Connection Lifecycle ──────────────────────────────────────────────
    newSocket.on('connect', () => {
      setSocketStatus('connected');

      // Backlog A.10: Flush offline queue upon reconnect
      if (offlineQueueRef.current.length > 0) {
        const queueToFlush = [...offlineQueueRef.current];
        offlineQueueRef.current = [];

        queueToFlush.forEach(({ conversationId, content, clientMsgId, resolve, reject }) => {
          newSocket.emit('send_message', { conversationId, content, clientMsgId }, (response) => {
            if (response && response.error) {
              if (reject) reject(new Error(response.error));
            } else {
              if (resolve) resolve(response);
            }
          });
        });
      }
    });

    newSocket.on('disconnect', (reason) => {
      setSocketStatus('disconnected');
      setOnlineUsers([]);
    });

    newSocket.on('connect_error', () => {
      setSocketStatus('reconnecting');
    });

    newSocket.io.on('reconnect_attempt', () => {
      setSocketStatus('reconnecting');
    });

    newSocket.io.on('reconnect', () => {
      setSocketStatus('connected');
    });

    // ─── Presence ──────────────────────────────────────────────────────────
    newSocket.on('presence_change', (data) => {
      if (data && Array.isArray(data.onlineUsers)) {
        setOnlineUsers(data.onlineUsers);
      }
    });

    // ─── Typing Indicators (Memory Only) ───────────────────────────────────
    newSocket.on('typing_start', (data) => {
      if (!data?.conversationId || !data?.userId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (!next[data.conversationId]) next[data.conversationId] = {};
        next[data.conversationId][data.userId] = data.username || `u/${data.userId}`;
        return next;
      });
    });

    newSocket.on('typing_stop', (data) => {
      if (!data?.conversationId || !data?.userId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (next[data.conversationId]) {
          delete next[data.conversationId][data.userId];
          if (Object.keys(next[data.conversationId]).length === 0) {
            delete next[data.conversationId];
          }
        }
        return next;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocketStatus('disconnected');
      setOnlineUsers([]);
      setTypingUsers({});
    };
  }, [accessToken]);

  // ─── Exposed Methods ─────────────────────────────────────────────────────

  const joinConversation = useCallback((conversationId) => {
    if (socketRef.current?.connected && conversationId) {
      socketRef.current.emit('join_conversation', { conversationId });
    }
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('leave_conversation', { conversationId });
    }
  }, []);

  /**
   * Backlog A.2 & A.3 & A.10:
   * Send message with clientMsgId, immediate ack response, and offline queue fallback.
   */
  const emitSendMessage = useCallback((conversationId, content, clientMsgId) => {
    const effectiveMsgId =
      clientMsgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return new Promise((resolve, reject) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(
          'send_message',
          {
            conversationId,
            content,
            clientMsgId: effectiveMsgId,
            tempId: effectiveMsgId,
          },
          (response) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response || { status: 'sent', clientMsgId: effectiveMsgId });
            }
          }
        );
      } else {
        // Enqueue offline message to flush upon reconnect
        offlineQueueRef.current.push({
          conversationId,
          content,
          clientMsgId: effectiveMsgId,
          resolve,
          reject,
        });
        resolve({ status: 'queued_offline', clientMsgId: effectiveMsgId });
      }
    });
  }, []);

  /**
   * Backlog A.5: Throttle typing_start to at most one per 2 seconds
   */
  const emitTypingStart = useCallback((conversationId) => {
    if (!conversationId || !socketRef.current?.connected) return;
    const now = Date.now();
    const lastSent = lastTypingSentRef.current[conversationId] || 0;
    if (now - lastSent >= 2000) {
      lastTypingSentRef.current[conversationId] = now;
      socketRef.current.emit('typing_start', { conversationId });
    }
  }, []);

  const emitTypingStop = useCallback((conversationId) => {
    if (socketRef.current?.connected && conversationId) {
      delete lastTypingSentRef.current[conversationId];
      socketRef.current.emit('typing_stop', { conversationId });
    }
  }, []);

  /**
   * Backlog A.6: Batch read receipts with last-read message ID, debounced by 300 ms
   */
  const emitBatchRead = useCallback((conversationId, lastReadMessageId) => {
    if (!conversationId || !lastReadMessageId) return;

    if (batchReadTimeoutRef.current[conversationId]) {
      clearTimeout(batchReadTimeoutRef.current[conversationId]);
    }

    batchReadTimeoutRef.current[conversationId] = setTimeout(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('batch_message_read', {
          conversationId,
          lastReadMessageId,
        });
      }
      delete batchReadTimeoutRef.current[conversationId];
    }, 300);
  }, []);

  /**
   * Notify room that a message has been delivered to this client
   */
  const emitMessageDelivered = useCallback((conversationId, messageId, clientMsgId) => {
    if (socketRef.current?.connected && conversationId && messageId) {
      socketRef.current.emit('message_delivered', {
        conversationId,
        messageId,
        clientMsgId,
      });
    }
  }, []);

  const socketValue = useMemo(
    () => ({
      socket,
      socketStatus,
      joinConversation,
      leaveConversation,
      emitSendMessage,
      emitTypingStart,
      emitTypingStop,
      emitBatchRead,
      emitMessageDelivered,
    }),
    [
      socket,
      socketStatus,
      joinConversation,
      leaveConversation,
      emitSendMessage,
      emitTypingStart,
      emitTypingStop,
      emitBatchRead,
      emitMessageDelivered,
    ]
  );

  const presenceValue = useMemo(
    () => ({
      onlineUsers,
    }),
    [onlineUsers]
  );

  const typingValue = useMemo(
    () => ({
      typingUsers,
    }),
    [typingUsers]
  );

  return (
    <SocketContext.Provider value={socketValue}>
      <PresenceContext.Provider value={presenceValue}>
        <TypingContext.Provider value={typingValue}>{children}</TypingContext.Provider>
      </PresenceContext.Provider>
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a SocketProvider');
  }
  return context;
};

export const useTyping = () => {
  const context = useContext(TypingContext);
  if (!context) {
    throw new Error('useTyping must be used within a SocketProvider');
  }
  return context;
};
