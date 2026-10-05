import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listCommunities } from '../api/communityApi';

export const LeftSidebar = () => {
  const { isAuthenticated } = useAuth();
  const [communities, setCommunities] = useState([]);

  useEffect(() => {
    const fetchComms = async () => {
      try {
        const res = await listCommunities('', 'members');
        setCommunities(res.data.communities || []);
      } catch (err) {
        console.error('[LeftSidebar] Failed to load communities:', err.message);
      }
    };

    fetchComms();

    // Listen for join/leave events to refresh list counts
    const handleRefresh = () => fetchComms();
    window.addEventListener('community-joined-change', handleRefresh);
    return () => window.removeEventListener('community-joined-change', handleRefresh);
  }, []);

  const displayLimit = 5;
  const visibleCommunities = communities.slice(0, displayLimit);
  const hasMore = communities.length > displayLimit;

  return (
    <aside className="left-sidebar">
      {/* MAIN SECTION */}
      <div className="sidebar-section">
        <h3>Main</h3>
        <ul className="sidebar-nav-list">
          <li>
            <NavLink to="/home" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Home</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/popular" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              <span>Popular</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/latest" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Latest</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/reviews" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
              <span>Reviews</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/resources" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>Resources</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/study-groups" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Study Groups</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/events" className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Events</span>
            </NavLink>
          </li>
        </ul>
      </div>

      {/* COMMUNITIES SECTION */}
      <div className="sidebar-section">
        <h3>Communities</h3>
        <ul className="sidebar-nav-list" style={{ marginBottom: '8px' }}>
          {visibleCommunities.length > 0 ? (
            visibleCommunities.map((comm) => (
              <li key={comm._id}>
                <NavLink
                  to={`/c/${comm.slug}`}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                  <span>c/{comm.name}</span>
                </NavLink>
              </li>
            ))
          ) : (
            <li
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                padding: '6px 10px',
                fontStyle: 'italic',
              }}
            >
              No communities found.
            </li>
          )}
        </ul>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            paddingLeft: '10px',
            fontSize: '13px',
          }}
        >
          {isAuthenticated && (
            <Link
              to="/communities/create"
              style={{
                display: 'block',
                padding: '6px 0',
                textDecoration: 'none',
                color: 'var(--accent)',
                fontWeight: '600',
              }}
            >
              + Create Community
            </Link>
          )}
        </div>
      </div>

      {/* PERSONAL SECTION */}
      {isAuthenticated && (
        <div className="sidebar-section">
          <h3>Personal</h3>
          <ul className="sidebar-nav-list">
            <li>
              <NavLink to="/saved" className={({ isActive }) => (isActive ? 'active' : '')}>
                Saved
              </NavLink>
            </li>
            <li>
              <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'active' : '')}>
                Notifications
              </NavLink>
            </li>
            <li>
              <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
                Chat
              </NavLink>
            </li>
          </ul>
        </div>
      )}

      {/* Explore All Communities at bottom */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e0db' }}>
        <Link
          to="/communities"
          style={{
            fontSize: '12px',
            textDecoration: 'underline',
            color: '#1a1a1a',
            fontWeight: 'bold',
            display: 'block',
            padding: '6px 10px',
          }}
        >
          Explore All Communities →
        </Link>
      </div>
    </aside>
  );
};
export default LeftSidebar;
