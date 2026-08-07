/**
 * Reddit-Inspired Hot Ranking Algorithm
 * Determines the engagement signal ranking for posts.
 */

// Anchor epoch: August 6, 2026
const EPOCH_ANCHOR = 1785984000; 

/**
 * Calculates the hot rank score for a post.
 * @param {number} upvoteCount - Number of upvotes
 * @param {number} downvoteCount - Number of downvotes
 * @param {Date} createdAt - Post creation date
 * @returns {number} The calculated rank score
 */
const calculateHotRank = (upvoteCount = 0, downvoteCount = 0, createdAt = new Date()) => {
  const score = upvoteCount - downvoteCount;
  
  // Sign determines direction of score influence
  let sign = 0;
  if (score > 0) sign = 1;
  else if (score < 0) sign = -1;

  // Logarithmic scale for score magnitude
  const order = Math.log10(Math.max(1, Math.abs(score)));

  // Time decay calculation (seconds elapsed since anchor epoch)
  const seconds = (createdAt.getTime() / 1000) - EPOCH_ANCHOR;

  // Reddit Hot Formula: sign * log10(max(1, |score|)) + seconds / 45000
  // 45000 seconds is 12.5 hours (the half-life factor of hot rank decay)
  return sign * order + seconds / 45000;
};

module.exports = { calculateHotRank };
