import React, { useState, useCallback } from 'react';
import { getHomeFeed } from '../api/feedApi';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/Skeleton';
import { useFeedSWR } from '../hooks/useFeedSWR';

export const HomeFeed = () => {
  const [sort, setSort] = useState('hot');
  const [page, setPage] = useState(1);

  const cacheKey = `home_feed_${sort}_${page}`;
  const fetcher = useCallback(async () => {
    const res = await getHomeFeed(sort, page, 10);
    return {
      posts: res.data.posts || [],
      totalPages: res.data.pagination?.pages || 1,
    };
  }, [sort, page]);

  const { posts, totalPages, loading, isRevalidating, error, revalidate, mutate } = useFeedSWR(cacheKey, fetcher);

  const handlePostDeleted = (deletedId) => {
    mutate((prev) => ({
      ...prev,
      posts: (prev?.posts || []).filter((p) => p._id !== deletedId),
    }));
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Home</h2>
          <div style={{ fontSize: '11px', color: '#666666' }}>
            Posts from your communities
          </div>
        </div>
        {isRevalidating && (
          <span style={{ fontSize: '10px', color: '#888', fontStyle: 'italic', alignSelf: 'center' }}>
            ● updating...
          </span>
        )}
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : error && posts.length === 0 ? (
        <div className="error-indicator">
          {error} <button onClick={() => revalidate(true)}>Try Again</button>
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
