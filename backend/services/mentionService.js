const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Extracts unique @usernames from a string.
 * Supports patterns like @username, @alice_99, etc.
 *
 * @param {string} text
 * @returns {string[]} Array of unique usernames (without @ prefix, lowercased)
 */
const extractMentions = (text) => {
  if (!text || typeof text !== 'string') return [];
  const regex = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1].toLowerCase());
  }
  return Array.from(matches);
};

/**
 * Processes mentions in a post or comment and dispatches notifications.
 * Strictly respects anonymity rules: if isAnonymous is true, actor is set to null
 * and message text discloses zero identity information.
 *
 * @param {Object} params
 * @param {string} params.text - The content containing potential mentions
 * @param {Object} params.author - The author user object ({ _id, username })
 * @param {boolean} [params.isAnonymous=false] - Whether the action is anonymous
 * @param {string|ObjectId} params.postId - Associated post ID
 * @param {string|ObjectId} [params.commentId=null] - Associated comment ID if comment
 */
const processMentions = async ({
  text,
  author,
  isAnonymous = false,
  postId,
  commentId = null,
}) => {
  if (!text || !author) return;

  const usernames = extractMentions(text);
  if (usernames.length === 0) return;

  const authorIdStr = author._id ? author._id.toString() : author.toString();

  // Find users whose usernames match the mentions (case-insensitive)
  const regexList = usernames.map((u) => new RegExp(`^${u}$`, 'i'));
  const users = await User.find({
    username: { $in: regexList },
  })
    .select('_id username')
    .lean();

  if (users.length === 0) return;

  const notifications = [];
  for (const recipient of users) {
    // Prevent self-notifications
    if (recipient._id.toString() === authorIdStr) continue;

    const message = isAnonymous
      ? `Someone mentioned you in an anonymous ${commentId ? 'comment' : 'post'}.`
      : `u/${author.username} mentioned you in a ${commentId ? 'comment' : 'post'}.`;

    notifications.push({
      recipient: recipient._id,
      actor: isAnonymous ? null : author._id,
      type: 'mention',
      post: postId,
      comment: commentId,
      message,
    });
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
};

module.exports = {
  extractMentions,
  processMentions,
};
