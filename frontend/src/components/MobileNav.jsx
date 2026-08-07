import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../api/notificationApi';

export const MobileNav = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchCount = async () => {
      try {
        const res = await getUnreadCount();
        setUnreadCount(res.data.count || 0);
      } catch {
        // silently fail — not critical for nav
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {/* Home */}
      <NavLink
        to="/home"
        className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
        aria-label="Home"
      >
        <span className="mobile-nav-icon">🏠</span>
        <span>Home</span>
      </NavLink>

      {/* Communities */}
      <NavLink
        to="/communities"
        className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
        aria-label="Communities"
      >
        <span className="mobile-nav-icon">🌐</span>
        <span>Explore</span>
      </NavLink>

      {/* Create */}
      {isAuthenticated ? (
        <NavLink
          to="/create-post"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label="Create post"
        >
          <span className="mobile-nav-icon">✏️</span>
          <span>Create</span>
        </NavLink>
      ) : (
        <button
          className="mobile-nav-item"
          onClick={() => navigate('/login')}
          aria-label="Login to create"
        >
          <span className="mobile-nav-icon">✏️</span>
          <span>Create</span>
        </button>
      )}

      {/* Notifications */}
      {isAuthenticated ? (
        <NavLink
          to="/notifications"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <span className="mobile-nav-icon">🔔</span>
          {unreadCount > 0 && (
            <span className="mobile-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
          <span>Alerts</span>
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label="Login"
        >
          <span className="mobile-nav-icon">🔔</span>
          <span>Alerts</span>
        </NavLink>
      )}

      {/* Chat */}
      {isAuthenticated ? (
        <NavLink
          to="/chat"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label="Chat"
        >
          <span className="mobile-nav-icon">💬</span>
          <span>Chat</span>
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label="Login to chat"
        >
          <span className="mobile-nav-icon">💬</span>
          <span>Chat</span>
        </NavLink>
      )}

      {/* Profile / Login */}
      {isAuthenticated ? (
        <NavLink
          to="/profile"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label="My profile"
        >
          <span className="mobile-nav-icon">👤</span>
          <span>{user?.username ? `u/${user.username.replace('u/', '')}` : 'Me'}</span>
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          aria-label="Login"
        >
          <span className="mobile-nav-icon">👤</span>
          <span>Login</span>
        </NavLink>
      )}
    </nav>
  );
};

export default MobileNav;
