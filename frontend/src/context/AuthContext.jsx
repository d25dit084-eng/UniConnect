import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as apiLogin, logout as apiLogout } from '../api/authApi';
import { getProfile } from '../api/userApi';

const AuthContext = createContext(null);

const clearChatLocalStorage = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('uniconnect_cached_msgs_') || key.startsWith('uniconnect_cached_convs_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.error('[AuthContext] Failed to clear chat cache:', err);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = React.useRef(null);

  // Clear chat cache whenever the logged-in userId changes
  useEffect(() => {
    const currentId = user?._id?.toString?.() || null;
    if (prevUserIdRef.current && currentId !== prevUserIdRef.current) {
      clearChatLocalStorage();
    }
    prevUserIdRef.current = currentId;
  }, [user?._id]);

  // Bootstrap authentication state
  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        try {
          const profileRes = await getProfile();
          setUser(profileRes.data.user);
          // Get the latest token from localStorage in case it got refreshed during getProfile()
          const latestToken = localStorage.getItem('accessToken');
          setAccessToken(latestToken);
        } catch (err) {
          console.error('[AuthBootstrap] Session validation failed:', err.message);
          // Token expired or invalid
          clearChatLocalStorage();
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          setAccessToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    // Listen for global logout events (from axios interceptor on session expiry)
    const handleGlobalLogout = () => {
      clearChatLocalStorage();
      setAccessToken(null);
      setUser(null);
    };

    // Listen for global token refresh events
    const handleTokenRefreshed = (e) => {
      if (e.detail?.accessToken) {
        setAccessToken(e.detail.accessToken);
      }
    };

    window.addEventListener('auth-logout', handleGlobalLogout);
    window.addEventListener('auth-token-refreshed', handleTokenRefreshed);

    bootstrap();

    return () => {
      window.removeEventListener('auth-logout', handleGlobalLogout);
      window.removeEventListener('auth-token-refreshed', handleTokenRefreshed);
    };
  }, []);

  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      const { accessToken, user: loggedUser } = data.data;
      if (user && user._id !== loggedUser._id) {
        clearChatLocalStorage();
      }
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));
      setAccessToken(accessToken);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    try {
      await apiLogout();
    } catch (err) {
      console.error('[Logout] Api call error:', err.message);
    } finally {
      clearChatLocalStorage();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setAccessToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  const updateCurrentUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login: loginUser,
        logout: logoutUser,
        updateCurrentUser,
        isAuthenticated: !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
