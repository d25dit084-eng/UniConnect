import React, { useState, useCallback } from 'react';
import { getPopularFeed } from '../api/feedApi';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/Skeleton';
import { useFeedSWR } from '../hooks/useFeedSWR';

export const PopularFeed = () => {
  const [page, setPage] = useState(1);

  const cacheKey = `popular_feed_${page}`;
  const fetcher = useCallback(async () => {
    const res = await getPopularFeed(page, 10);
    return {
      posts: res.data.posts || [],
      totalPages: res.data.pagination?.pages || 1,
    };
  }, [page]);

  const { posts, totalPages, loading, isRevalidating, error, revalidate, mutate } = useFeedSWR(
    cacheKey,
    fetcher
  );

  const handlePostDeleted = (deletedId) => {
    mutate((prev) => ({
      ...prev,
      posts: (prev?.posts || []).filter((p) => p._id !== deletedId),
    }));
  };

  return (
    <div>
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h2>Popular Feed</h2>
          <div style={{ fontSize: '11px', color: '#555' }}>
            Trending discussions on UniConnect sorted by engagement and recency
          </div>
        </div>
        {isRevalidating && (
          <span
            style={{ fontSize: '10px', color: '#888', fontStyle: 'italic', alignSelf: 'center' }}
          >
            ● updating...
          </span>
        )}
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

          <div
            style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}
          >
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
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
        <div className="empty-indicator">No posts available.</div>
      )}
    </div>
  );
};

export default PopularFeed;
