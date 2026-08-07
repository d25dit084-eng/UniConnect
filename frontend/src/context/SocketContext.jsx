import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]); // array of userId strings
  const [typingUsers, setTypingUsers] = useState({}); // conversationId -> { userId: username }
  const [socketStatus, setSocketStatus] = useState('disconnected'); // 'connected'|'disconnected'|'reconnecting'
  const socketRef = useRef(null);

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

    const newSocket = io(socketUrl, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = newSocket;

    // ─── Connection lifecycle ──────────────────────────────────────────────
    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setSocketStatus('connected');
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      setSocketStatus('disconnected');
      setOnlineUsers([]);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setSocketStatus('reconnecting');
    });

    newSocket.io.on('reconnect_attempt', () => {
      setSocketStatus('reconnecting');
    });

    newSocket.io.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      setSocketStatus('connected');
    });

    // ─── Presence: server emits { onlineUsers: string[] } ─────────────────
    newSocket.on('presence_change', (data) => {
      if (data && Array.isArray(data.onlineUsers)) {
        setOnlineUsers(data.onlineUsers);
      }
    });

    // ─── Typing: server emits { conversationId, userId, username } ─────────
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

  // ─── Helpers exposed via context ───────────────────────────────────────────

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
   * Send a message via WebSocket (real-time path).
   * Returns a tempId that the server will echo back in new_message for dedup.
   */
  const emitSendMessage = useCallback((conversationId, content) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', { conversationId, content, tempId });
      return tempId;
    }
    return null;
  }, []);

  const emitTypingStart = useCallback((conversationId) => {
    if (socketRef.current?.connected && conversationId) {
      socketRef.current.emit('typing_start', { conversationId });
    }
  }, []);

  const emitTypingStop = useCallback((conversationId) => {
    if (socketRef.current?.connected && conversationId) {
      socketRef.current.emit('typing_stop', { conversationId });
    }
  }, []);

  const emitMessageRead = useCallback((conversationId, messageId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message_read', { conversationId, messageId });
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
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
      }}
    >
      {children}
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
