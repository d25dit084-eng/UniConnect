import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listCommunities, joinCommunity, leaveCommunity, getJoinedCommunities } from '../api/communityApi';
import { useAuth } from '../context/AuthContext';

export const ExploreCommunities = () => {
  const { isAuthenticated } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('members');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCommunities = async () => {
    setLoading(true);
    setError('');
    try {
      const listRes = await listCommunities(q, sort);
      setCommunities(listRes.data.communities || []);

      if (isAuthenticated) {
        const joinedRes = await getJoinedCommunities();
        const joinedSet = new Set(joinedRes.data.communities.map((c) => c._id));
        setJoinedIds(joinedSet);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load communities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCommunities();
  };

  const handleJoinToggle = async (community) => {
    const isJoined = joinedIds.has(community._id);
    try {
      if (isJoined) {
        await leaveCommunity(community._id);
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.delete(community._id);
          return next;
        });
        // Decrement local count
        setCommunities((prev) =>
          prev.map((c) => (c._id === community._id ? { ...c, membersCount: c.membersCount - 1 } : c))
        );
      } else {
        await joinCommunity(community._id);
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.add(community._id);
          return next;
        });
        setCommunities((prev) =>
          prev.map((c) => (c._id === community._id ? { ...c, membersCount: c.membersCount + 1 } : c))
        );
      }
      // Broadcast event to refresh sidebar joined communities list
      window.dispatchEvent(new Event('community-joined-change'));
    } catch (err) {
      alert(`Membership action failed: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Explore Communities</h2>
        <div style={{ fontSize: '11px', color: '#666666' }}>
          Find communities and conversations that interest you.
        </div>
      </div>

      <div className="search-filter-bar">
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search communities by name or description..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="members">Members Count</option>
          <option value="posts">Posts Count</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-indicator">Loading communities...</div>
      ) : error ? (
        <div className="error-indicator">
          {error} <button onClick={fetchCommunities}>Try Again</button>
        </div>
      ) : communities.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {communities.map((comm) => {
            const isJoined = joinedIds.has(comm._id);
            return (
              <div key={comm._id} className="community-card">
                <div className="community-card-info">
                  <h4 style={{ fontSize: '15px', color: '#1a1a1a' }}>
                    <Link to={`/c/${comm.slug}`}>c/{comm.name}</Link>{' '}
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666666' }}>
                      ({comm.displayName})
                    </span>
                  </h4>
                  <p style={{ fontSize: '12px', margin: '4px 0', color: '#1a1a1a' }}>
                    {comm.description}
                  </p>
                  <div style={{ fontSize: '11px', color: '#666666' }}>
                    {comm.membersCount} member(s) • {comm.postsCount || 0} post(s) • Type: {comm.visibility}
                  </div>
                </div>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => handleJoinToggle(comm)}
                    style={{
                      background: isJoined ? '#ffffff' : '#1a1a1a',
                      color: isJoined ? '#1a1a1a' : '#ffffff',
                      border: isJoined ? '1px solid #d2cfc9' : '1px solid #1a1a1a',
                    }}
                  >
                    {isJoined ? 'Leave' : 'Join'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-indicator">No communities found.</div>
      )}
    </div>
  );
};
export default ExploreCommunities;
