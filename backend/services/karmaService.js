const User = require('../models/User');

// Delayed karma buffer for anonymous posts/comments
// Map<userIdString, { post: number, comment: number, executeAt: number }>
const delayedKarmaBuffer = new Map();

/**
 * Updates a user's post or comment karma based on the net score change.
 * @param {string} userId - ID of the user whose karma is changing
 * @param {string} type - 'post' or 'comment'
 * @param {number} change - The net vote change (e.g. +1, -1, +2, -2)
 */
const updateKarma = async (userId, type, change) => {
  if (!userId || change === 0) return;

  const karmaField = type === 'post' ? 'karma.post' : 'karma.comment';

  // Atomically increment the specific field and total karma
  await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        [karmaField]: change,
        'karma.total': change,
      },
    },
    { new: false } // We don't need the returned document
  );
};

/**
 * Buffers karma changes for anonymous posts/comments and applies them
 * in jittered batches to prevent timing de-anonymization attacks.
 */
const queueDelayedKarma = (userId, type, change, delayMs = null) => {
  if (!userId || change === 0) return;
  const idStr = userId.toString();
  const now = Date.now();
  const executeAt = now + (delayMs !== null ? delayMs : (30000 + Math.random() * 30000));
  const entry = delayedKarmaBuffer.get(idStr) || { post: 0, comment: 0, executeAt };
  if (type === 'post') entry.post += change;
  if (type === 'comment') entry.comment += change;
  delayedKarmaBuffer.set(idStr, entry);
};

/**
 * Flush all ready delayed karma updates to MongoDB
 */
const flushDelayedKarma = async (forceAll = false) => {
  const now = Date.now();
  const tasks = [];

  for (const [idStr, entry] of delayedKarmaBuffer.entries()) {
    if (forceAll || now >= entry.executeAt) {
      delayedKarmaBuffer.delete(idStr);
      const inc = {};
      let totalChange = 0;
      if (entry.post !== 0) {
        inc['karma.post'] = entry.post;
        totalChange += entry.post;
      }
      if (entry.comment !== 0) {
        inc['karma.comment'] = entry.comment;
        totalChange += entry.comment;
      }
      if (totalChange !== 0) {
        inc['karma.total'] = totalChange;
        tasks.push(User.findByIdAndUpdate(idStr, { $inc: inc }));
      }
    }
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
};

// Periodic flush timer every 15 seconds
setInterval(() => {
  flushDelayedKarma().catch((err) =>
    console.error('[KarmaService] Error flushing delayed karma:', err.message)
  );
}, 15000).unref();

module.exports = { updateKarma, queueDelayedKarma, flushDelayedKarma };
