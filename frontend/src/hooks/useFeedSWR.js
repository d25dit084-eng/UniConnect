import { useState, useEffect, useRef, useCallback } from 'react';

// In-memory stale-while-revalidate cache (persists during SPA session)
const swrMemoryCache = new Map();

/**
 * useFeedSWR: Custom stale-while-revalidate hook for feeds
 * @param {string} cacheKey - Unique key for query (e.g. 'home_feed_hot_1')
 * @param {Function} fetchFn - Async function returning { posts, totalPages }
 * @param {Object} options - { ttl: number (ms) }
 */
export const useFeedSWR = (cacheKey, fetchFn, options = {}) => {
  const { ttl = 60000 } = options; // 1-minute freshness window

  const getCached = useCallback(() => {
    if (!cacheKey) return null;
    return swrMemoryCache.get(cacheKey) || null;
  }, [cacheKey]);

  const initialCache = getCached();

  const [data, setData] = useState(() => initialCache?.data || null);
  const [loading, setLoading] = useState(() => !initialCache);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState('');

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const revalidate = useCallback(
    async (bypassTtl = false) => {
      if (!cacheKey) return;
      const cached = swrMemoryCache.get(cacheKey);
      const now = Date.now();

      // If fresh cached data exists and we don't bypass freshness, display without network call
      if (cached && !bypassTtl && now - cached.timestamp < ttl) {
        setData(cached.data);
        setLoading(false);
        return cached.data;
      }

      if (cached) {
        // Stale exists: immediately display stale data, revalidate silently in background
        setData(cached.data);
        setLoading(false);
        setIsRevalidating(true);
      } else {
        // No cache: initial loading skeleton
        setLoading(true);
      }

      setError('');

      try {
        const result = await fetchFnRef.current();
        swrMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        setData(result);
        return result;
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message || 'Failed to fetch feed';
        setError(errMsg);
        // If we have stale data, keep displaying it rather than blowing away the UI!
      } finally {
        setLoading(false);
        setIsRevalidating(false);
      }
    },
    [cacheKey, ttl]
  );

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  // Optimistic cache mutation (e.g. removing deleted posts or updating upvotes)
  const mutate = useCallback(
    (updater) => {
      setData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (cacheKey && next !== undefined) {
          swrMemoryCache.set(cacheKey, { data: next, timestamp: Date.now() });
        }
        return next;
      });
    },
    [cacheKey]
  );

  return {
    posts: data?.posts || [],
    totalPages: data?.totalPages || 1,
    loading,
    isRevalidating,
    error,
    revalidate,
    mutate,
  };
};

export default useFeedSWR;
