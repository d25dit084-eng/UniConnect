import React, { useState, useEffect } from 'react';
import { getSavedPosts } from '../api/savedApi';
import { PostCard } from '../components/PostCard';

export const SavedPosts = () => {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSaved = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSavedPosts(page, 10);
      setPosts(res.data.posts || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load saved posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, [page]);

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  return (
    <div>
      <div className="page-header">
        <h2>Your Saved Posts</h2>
        <div style={{ fontSize: '11px', color: '#555' }}>
          Only you can view these bookmarked discussions
        </div>
      </div>

      {loading ? (
        <div className="loading-indicator">Loading bookmarks...</div>
      ) : error ? (
        <div className="error-indicator">{error}</div>
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
        <div className="empty-indicator">No saved posts yet.</div>
      )}
    </div>
  );
};
export default SavedPosts;
