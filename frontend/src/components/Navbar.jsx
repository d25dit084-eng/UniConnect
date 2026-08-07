import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../api/notificationApi';

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchCount = async () => {
      try {
        const res = await getUnreadCount();
        setUnreadCount(res.data.count || 0);
      } catch (err) {
        console.error('[NavbarNotifications] Failed to load unread count:', err.message);
      }
    };

    fetchCount();
    // Poll unread count every 30 seconds
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [navigate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
    }
  };

  const handleLogoutClick = async () => {
    setShowDropdown(false);
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className="navbar">
        {/* Brand */}
        <Link to="/" className="navbar-brand">UniConnect</Link>

        {/* Desktop search bar */}
        <form onSubmit={handleSearchSubmit} className="navbar-search">
          <input
            type="search"
            placeholder="Search communities, posts and users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search"
          />
        </form>

        {/* Desktop action links */}
        <div className="navbar-actions">
          <div className="navbar-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isAuthenticated ? (
              <>
                <Link to="/create-post" style={{ textDecoration: 'none' }}>
                  <button type="button">Create</button>
                </Link>
                <Link to="/chat" style={{ textDecoration: 'none', color: '#666' }}>Chat</Link>
                <Link to="/notifications" style={{ textDecoration: 'none', color: '#666' }}>
                  🔔{unreadCount > 0 ? ` ${unreadCount}` : ''}
                </Link>

                {/* User dropdown */}
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                  <button
                    type="button"
                    id="user-menu-btn"
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{ fontWeight: 'bold' }}
                    aria-haspopup="true"
                    aria-expanded={showDropdown}
                  >
                    u/{user?.username} ▼
                  </button>
                  {showDropdown && (
                    <div className="navbar-dropdown" role="menu">
                      <Link
                        to="/profile"
                        onClick={() => setShowDropdown(false)}
                        role="menuitem"
                      >
                        My Profile
                      </Link>
                      <Link
                        to={`/u/${user?.username?.replace('u/', '')}`}
                        onClick={() => setShowDropdown(false)}
                        role="menuitem"
                      >
                        Public Profile
                      </Link>
                      <Link
                        to="/saved"
                        onClick={() => setShowDropdown(false)}
                        role="menuitem"
                      >
                        Saved Posts
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setShowDropdown(false)}
                        role="menuitem"
                      >
                        Settings
                      </Link>
                      {user?.role === 'admin' && (
                        <Link
                          to="/admin"
                          onClick={() => setShowDropdown(false)}
                          role="menuitem"
                          style={{ fontWeight: 'bold' }}
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <div className="navbar-dropdown-divider" />
                      <button
                        type="button"
                        onClick={handleLogoutClick}
                        role="menuitem"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" style={{ textDecoration: 'none', color: '#666' }}>Login</Link>
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  <button type="button">Register</button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile: search icon */}
          <button
            type="button"
            className="navbar-search-toggle"
            onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileMenuOpen(false); }}
            aria-label="Toggle search"
          >
            🔍
          </button>

          {/* Mobile: hamburger */}
          <button
            type="button"
            className="navbar-hamburger"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileSearchOpen(false); }}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile search bar (dropdown) */}
      {mobileSearchOpen && (
        <form
          onSubmit={handleSearchSubmit}
          className="navbar-search mobile-open"
          style={{ display: 'flex' }}
        >
          <input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            aria-label="Mobile search"
            style={{ flex: 1 }}
          />
          <button type="submit" style={{ marginLeft: '8px', flexShrink: 0 }}>Go</button>
        </form>
      )}

      {/* Mobile drawer menu */}
      <div className={`navbar-mobile-drawer${mobileMenuOpen ? ' open' : ''}`} role="navigation" aria-label="Mobile menu">
        {isAuthenticated ? (
          <>
            <Link to="/home" onClick={closeMobileMenu}>🏠 Home</Link>
            <Link to="/communities" onClick={closeMobileMenu}>🌐 Explore Communities</Link>
            <Link to="/create-post" onClick={closeMobileMenu}>✏️ Create Post</Link>
            <Link to="/notifications" onClick={closeMobileMenu}>
              🔔 Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Link>
            <Link to="/chat" onClick={closeMobileMenu}>💬 Chat</Link>
            <Link to="/saved" onClick={closeMobileMenu}>🔖 Saved Posts</Link>
            <Link to="/profile" onClick={closeMobileMenu}>⚙️ Settings / Profile</Link>
            {user?.role === 'admin' && (
              <Link to="/admin" onClick={closeMobileMenu} style={{ fontWeight: 'bold' }}>
                🛡️ Admin Dashboard
              </Link>
            )}
            <div style={{ borderTop: '1px solid #e2e0db', margin: '4px 0' }} />
            <button type="button" onClick={handleLogoutClick} style={{ color: '#aa2d00', textAlign: 'left' }}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/home" onClick={closeMobileMenu}>🏠 Home</Link>
            <Link to="/communities" onClick={closeMobileMenu}>🌐 Explore Communities</Link>
            <Link to="/login" onClick={closeMobileMenu}>Login</Link>
            <Link to="/register" onClick={closeMobileMenu}>Register</Link>
          </>
        )}
      </div>
    </>
  );
};

export default Navbar;
