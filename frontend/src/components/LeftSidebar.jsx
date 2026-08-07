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
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/popular" className={({ isActive }) => (isActive ? 'active' : '')}>
              Popular
            </NavLink>
          </li>
          <li>
            <NavLink to="/latest" className={({ isActive }) => (isActive ? 'active' : '')}>
              Latest
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
                <NavLink to={`/c/${comm.slug}`} className={({ isActive }) => (isActive ? 'active' : '')}>
                  c/{comm.name}
                </NavLink>
              </li>
            ))
          ) : (
            <li style={{ fontSize: '11px', color: '#666666', padding: '6px 10px', fontStyle: 'italic' }}>
              No communities found.
            </li>
          )}
        </ul>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '10px', fontSize: '13px' }}>
          {isAuthenticated && (
            <Link to="/communities/create" style={{ display: 'block', padding: '4px 0', textDecoration: 'none', color: '#1a1a1a', fontWeight: 'bold' }}>
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
        <Link to="/communities" style={{ fontSize: '12px', textDecoration: 'underline', color: '#1a1a1a', fontWeight: 'bold', display: 'block', padding: '6px 10px' }}>
          Explore All Communities →
        </Link>
      </div>
    </aside>
  );
};
export default LeftSidebar;
