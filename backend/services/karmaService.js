const User = require('../models/User');

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

module.exports = { updateKarma };
