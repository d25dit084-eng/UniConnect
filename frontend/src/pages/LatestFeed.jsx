import React, { useState, useEffect } from 'react';
import { getLatestFeed } from '../api/feedApi';
import { PostCard } from '../components/PostCard';
import { useSocket } from '../context/SocketContext';

export const LatestFeed = () => {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newPostsCount, setNewPostsCount] = useState(0);

  const { socket } = useSocket();

  const fetchFeed = async (resetCount = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await getLatestFeed(page, 10);
      setPosts(res.data.posts || []);
      setTotalPages(res.data.pagination?.pages || 1);
      if (resetCount) {
        setNewPostsCount(0);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load latest feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [page]);

  // Subscribe to real-time new_post triggers
  useEffect(() => {
    if (!socket) return;

    const handleNewPost = () => {
      setNewPostsCount((prev) => prev + 1);
    };

    socket.on('new_post', handleNewPost);
    return () => {
      socket.off('new_post', handleNewPost);
    };
  }, [socket]);

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  const handleLoadNewPosts = () => {
    setPage(1);
    fetchFeed(true);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Latest/Live Feed</h2>
        <div style={{ fontSize: '11px', color: '#555' }}>
          Chronological listing of new posts across UniConnect
        </div>
      </div>

      {newPostsCount > 0 && (
        <div
          style={{
            background: '#eeeeee',
            border: '1px solid #000000',
            padding: '10px',
            textAlign: 'center',
            marginBottom: '15px',
          }}
        >
          <strong>{newPostsCount}</strong> new post(s) available.{' '}
          <button type="button" onClick={handleLoadNewPosts}>
            Load New Posts
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-indicator">Loading posts...</div>
      ) : error ? (
        <div className="error-indicator">
          {error} <button onClick={() => fetchFeed()}>Try Again</button>
        </div>
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
        <div className="empty-indicator">
          No posts available.
        </div>
      )}
    </div>
  );
};
export default LatestFeed;
