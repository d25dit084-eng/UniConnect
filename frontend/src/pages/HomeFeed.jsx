import React, { useState, useEffect } from 'react';
import { getHomeFeed } from '../api/feedApi';
import { PostCard } from '../components/PostCard';

export const HomeFeed = () => {
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('hot');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFeed = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getHomeFeed(sort, page, 10);
      setPosts(res.data.posts || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load home feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [sort, page]);

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  return (
    <div>
      <div className="page-header">
        <h2>Home</h2>
        <div style={{ fontSize: '11px', color: '#666666' }}>
          Posts from your communities
        </div>
      </div>

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

      {loading ? (
        <div className="loading-indicator">Loading posts...</div>
      ) : error ? (
        <div className="error-indicator">
          {error} <button onClick={fetchFeed}>Try Again</button>
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
          No posts yet. Try exploring communities and joining them!
        </div>
      )}
    </div>
  );
};
export default HomeFeed;
