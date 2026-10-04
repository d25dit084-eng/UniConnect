import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as apiLogin, logout as apiLogout } from '../api/authApi';
import { getProfile } from '../api/userApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

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
      const { accessToken, user } = data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      setAccessToken(accessToken);
      setUser(user);
      return user;
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
