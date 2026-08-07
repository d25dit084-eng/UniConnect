import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCommunityDetails, joinCommunity, leaveCommunity, getCommunityPosts } from '../api/communityApi';
import { PostCard } from '../components/PostCard';
import { useAuth } from '../context/AuthContext';

export const CommunityPage = () => {
  const { slug } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('hot');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCommunityDetails(slug);
      setCommunity(res.data.community);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load community');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await getCommunityPosts(slug, sort, page, 10);
      setPosts(res.data.posts || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      console.error('[CommunityPage] Failed to load posts:', err.message);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [slug]);

  useEffect(() => {
    if (community) {
      fetchPosts();
    }
  }, [community, sort, page]);

  const handleJoinToggle = async () => {
    if (!isAuthenticated) return;
    try {
      if (community.isJoined) {
        await leaveCommunity(community._id);
        setCommunity((prev) => ({
          ...prev,
          isJoined: false,
          membersCount: prev.membersCount - 1,
          memberRole: null,
        }));
      } else {
        await joinCommunity(community._id);
        setCommunity((prev) => ({
          ...prev,
          isJoined: true,
          membersCount: prev.membersCount + 1,
          memberRole: 'member',
        }));
      }
      window.dispatchEvent(new Event('community-joined-change'));
    } catch (err) {
      alert(`Action failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  if (loading) return <div className="loading-indicator">Loading community...</div>;
  if (error) return <div className="error-indicator">{error}</div>;
  if (!community) return <div className="empty-indicator">Community not found.</div>;

  const isModerator = community.memberRole === 'moderator' || community.memberRole === 'owner';
  const isAdmin = user && user.role === 'admin';

  return (
    <div>
      {/* Header Info */}
      <div className="community-header">
        <div className="community-header-inner">
          <div className="community-header-info">
            <h2 style={{ fontSize: '20px' }}>c/{community.name}</h2>
            <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0', overflowWrap: 'break-word' }}>
              {community.displayName}
            </div>
            <p style={{ fontSize: '13px', margin: '8px 0', overflowWrap: 'break-word' }}>{community.description}</p>
            <div style={{ fontSize: '11px', color: '#666666' }}>
              <strong>{community.membersCount}</strong> member(s) • <strong>{community.postsCount}</strong> post(s) • Visibility: {community.visibility}
            </div>
          </div>

          <div className="community-header-actions">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleJoinToggle}
                style={{
                  background: community.isJoined ? '#ffffff' : '#1a1a1a',
                  color: community.isJoined ? '#1a1a1a' : '#ffffff',
                  border: community.isJoined ? '1px solid #d2cfc9' : '1px solid #1a1a1a',
                }}
              >
                {community.isJoined ? 'Leave' : 'Join'}
              </button>
            )}

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate('/create-post', { state: { communityId: community._id, name: community.name } })}
              >
                Create Post
              </button>
            )}

            {isAuthenticated && (isModerator || isAdmin) && (
              <Link to={`/c/${community.slug}/mod`}>
                <button type="button" className="btn-secondary" style={{ width: '100%' }}>
                  Moderation
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Rules */}
        {community.rules && community.rules.length > 0 && (
          <div style={{ marginTop: '15px', borderTop: '1px solid #e2e0db', paddingTop: '10px' }}>
            <strong style={{ fontSize: '12px' }}>Community Rules:</strong>
            <ol style={{ fontSize: '11px', paddingLeft: '20px', marginTop: '4px' }}>
              {community.rules.map((rule, idx) => (
                <li key={rule._id || idx}>
                  <strong>{rule.title}</strong>: {rule.description}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Sorting Tabs */}
      <div className="tabs-container">
        <button
          type="button"
          className={`tab-button ${sort === 'hot' ? 'active' : ''}`}
          onClick={() => { setSort('hot'); setPage(1); }}
        >
          Hot
        </button>
        <button
          type="button"
          className={`tab-button ${sort === 'new' ? 'active' : ''}`}
          onClick={() => { setSort('new'); setPage(1); }}
        >
          New
        </button>
        <button
          type="button"
          className={`tab-button ${sort === 'top' ? 'active' : ''}`}
          onClick={() => { setSort('top'); setPage(1); }}
        >
          Top
        </button>
      </div>

      {/* Posts sub-feed */}
      {postsLoading ? (
        <div className="loading-indicator">Loading posts...</div>
      ) : posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onPostDeleted={handlePostDeleted} />
          ))}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous Page
            </button>
            <span style={{ fontSize: '13px', alignSelf: 'center' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next Page
            </button>
          </div>
        </>
      ) : (
        <div className="empty-indicator">No posts in this community yet.</div>
      )}
    </div>
  );
};
export default CommunityPage;
