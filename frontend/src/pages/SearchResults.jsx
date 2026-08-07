import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { globalSearch } from '../api/searchApi';
import { PostCard } from '../components/PostCard';

export const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [type, setType] = useState('posts'); // posts, communities, users
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchResults = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await globalSearch(query, type, page, 10);
      setResults(res.data.results || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Search query failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setResults([]);
  }, [query, type]);

  useEffect(() => {
    fetchResults();
  }, [query, type, page]);

  const handlePostDeleted = (deletedId) => {
    setResults((prev) => prev.filter((p) => p._id !== deletedId));
  };

  return (
    <div>
      <div className="page-header">
        <h2>Search Results</h2>
        <div style={{ fontSize: '12px', color: '#555' }}>
          Showing results for "<strong>{query}</strong>"
        </div>
      </div>

      <div className="tabs-container">
        <button
          type="button"
          className={`tab-button ${type === 'posts' ? 'active' : ''}`}
          onClick={() => setType('posts')}
        >
          📝 Posts
        </button>
        <button
          type="button"
          className={`tab-button ${type === 'communities' ? 'active' : ''}`}
          onClick={() => setType('communities')}
        >
          🏔️ Communities
        </button>
        <button
          type="button"
          className={`tab-button ${type === 'users' ? 'active' : ''}`}
          onClick={() => setType('users')}
        >
          👥 Users
        </button>
      </div>

      {loading ? (
        <div className="loading-indicator">Searching...</div>
      ) : error ? (
        <div className="error-indicator">{error}</div>
      ) : results.length > 0 ? (
        <>
          {type === 'posts' && (
            <div>
              {results.map((post) => (
                <PostCard key={post._id} post={post} onPostDeleted={handlePostDeleted} />
              ))}
            </div>
          )}

          {type === 'communities' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results.map((comm) => (
                <div key={comm._id} style={{ border: '1px solid #000', padding: '10px', background: '#fff' }}>
                  <h4>
                    <Link to={`/c/${comm.slug}`}>c/{comm.name}</Link>
                  </h4>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>{comm.description}</p>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {comm.membersCount} member(s) • Visibility: {comm.visibility}
                  </div>
                </div>
              ))}
            </div>
          )}

          {type === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results.map((u) => (
                <div key={u.username} style={{ border: '1px solid #000', padding: '10px', background: '#fff' }}>
                  <h4>
                    <Link to={`/u/${u.username.replace('u/', '')}`}>{u.username}</Link>
                  </h4>
                  {u.bio && <p style={{ fontSize: '12px', margin: '4px 0' }}>{u.bio}</p>}
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    Karma: {u.karma?.total || 0} (Post: {u.karma?.post || 0}, Comment: {u.karma?.comment || 0})
                  </div>
                </div>
              ))}
            </div>
          )}

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
        <div className="empty-indicator">No results found matching "{query}".</div>
      )}
    </div>
  );
};
export default SearchResults;
