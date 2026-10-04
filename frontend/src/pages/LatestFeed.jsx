import React, { useState, useEffect, useCallback } from 'react';
import { getLatestFeed } from '../api/feedApi';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/Skeleton';
import { useSocket } from '../context/SocketContext';
import { useFeedSWR } from '../hooks/useFeedSWR';

export const LatestFeed = () => {
  const [page, setPage] = useState(1);
  const [newPostsCount, setNewPostsCount] = useState(0);

  const { socket } = useSocket();

  const cacheKey = `latest_feed_${page}`;
  const fetcher = useCallback(async () => {
    const res = await getLatestFeed(page, 10);
    return {
      posts: res.data.posts || [],
      totalPages: res.data.pagination?.pages || 1,
    };
  }, [page]);

  const { posts, totalPages, loading, isRevalidating, error, revalidate, mutate } = useFeedSWR(
    cacheKey,
    fetcher
  );

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
    mutate((prev) => ({
      ...prev,
      posts: (prev?.posts || []).filter((p) => p._id !== deletedId),
    }));
  };

  const handleLoadNewPosts = () => {
    setPage(1);
    setNewPostsCount(0);
    revalidate(true);
  };

  return (
    <div>
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h2>Latest/Live Feed</h2>
          <div style={{ fontSize: '11px', color: '#555' }}>
            Chronological listing of new posts across UniConnect
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

export default LatestFeed;
