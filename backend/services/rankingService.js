/**
 * UniConnect Engagement & Hot Ranking Algorithm
 * Implements Reddit-inspired logarithmic score, time decay, and discussion velocity.
 */

// Anchor epoch: August 6, 2026
const EPOCH_ANCHOR = 1785984000;

/**
 * Calculates the hot rank score for a post.
 * Supports both signatures:
 *   calculateHotRank(upvoteCount, downvoteCount, commentCount, createdAt)
 *   calculateHotRank(upvoteCount, downvoteCount, createdAt) // backwards compatible
 *
 * @param {number} upvoteCount - Number of upvotes
 * @param {number} downvoteCount - Number of downvotes
 * @param {number|Date} [commentCount=0] - Number of comments or createdAt Date (backwards compat)
 * @param {Date} [createdAt=new Date()] - Post creation date
 * @returns {number} The calculated rank score
 */
const calculateHotRank = (
  upvoteCount = 0,
  downvoteCount = 0,
  commentCount = 0,
  createdAt = new Date()
) => {
  let resolvedComments = 0;
  let resolvedCreatedAt = createdAt;

  // Handle 3-argument legacy calls where 3rd arg was Date
  if (commentCount instanceof Date || (typeof commentCount === 'string' && isNaN(commentCount))) {
    resolvedCreatedAt = new Date(commentCount);
    resolvedComments = 0;
  } else {
    resolvedComments = Number(commentCount) || 0;
  }

  const safeUpvotes = Math.max(0, Number(upvoteCount) || 0);
  const safeDownvotes = Math.max(0, Number(downvoteCount) || 0);
  const voteNet = safeUpvotes - safeDownvotes;

  // Effective score: comments act as strong discussion signals (1 comment = 2 upvotes in engagement)
  const effectiveScore = voteNet + resolvedComments * 2;

  let sign = 0;
  if (effectiveScore > 0) sign = 1;
  else if (effectiveScore < 0) sign = -1;

  // Logarithmic scale for score magnitude
  const order = Math.log10(Math.max(1, Math.abs(effectiveScore)));

  // Time decay calculation (seconds elapsed since anchor epoch)
  const dateObj = resolvedCreatedAt instanceof Date ? resolvedCreatedAt : new Date(resolvedCreatedAt);
  const seconds = dateObj.getTime() / 1000 - EPOCH_ANCHOR;

  // Half-life factor: 45000 seconds = 12.5 hours
  return sign * order + seconds / 45000;
};

/**
 * Calculates rising velocity rank for recently posted content (< 48 hours).
 *
 * @param {number} score - Net upvotes score
 * @param {number} commentCount - Number of comments
 * @param {Date} createdAt - Post creation date
 * @returns {number} Velocity score
 */
const calculateRisingRank = (score = 0, commentCount = 0, createdAt = new Date()) => {
  const dateObj = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const hoursAge = Math.max(0.1, (Date.now() - dateObj.getTime()) / (1000 * 60 * 60));

  // High velocity recent activity decays exponentially after 48h
  const effectiveEngagement = Math.max(0, score) + (Number(commentCount) || 0) * 3;
  return effectiveEngagement / Math.pow(hoursAge + 2, 1.35);
};

/**
 * Calculates controversy rank for polarizing topics with high engagement on both sides.
 *
 * @param {number} upvoteCount
 * @param {number} downvoteCount
 * @param {number} commentCount
 * @returns {number}
 */
const calculateControversialRank = (upvoteCount = 0, downvoteCount = 0, commentCount = 0) => {
  const up = Math.max(0, upvoteCount);
  const down = Math.max(0, downvoteCount);
  const total = up + down;
  if (total === 0) return 0;

  const balance = Math.min(up, down) / Math.max(up, down);
  return total * balance + (Number(commentCount) || 0) * 0.5;
};

/**
 * Returns date filter object for Top feed time-window scoping.
 *
 * @param {string} timeframe - 'today' | 'week' | 'month' | 'year' | 'all'
 * @returns {Date|null}
 */
const getTimeframeDate = (timeframe) => {
  const now = Date.now();
  switch (timeframe) {
    case 'today':
    case 'day':
      return new Date(now - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now - 365 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
};

module.exports = {
  calculateHotRank,
  calculateRisingRank,
  calculateControversialRank,
  getTimeframeDate,
};
