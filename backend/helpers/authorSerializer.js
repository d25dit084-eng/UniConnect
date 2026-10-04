const { getAnonymousAlias } = require('../utils/anonymousIdentity');

/**
 * Centralized Author Serializer for UniConnect
 *
 * Enforces zero-leak anonymity rules:
 * - If doc.isAnonymous is true:
 *   - Completely masks real user _id, username, avatar, bio, and karma.
 *   - Generates deterministic per-thread HMAC alias using threadId.
 *   - Computes isOP (true if this author is the original thread poster).
 *   - Computes isMine (true ONLY if the authenticated viewer is the author).
 * - If doc.isAnonymous is false:
 *   - Formats public profile with pseudonymous u/ prefix, avatar, karma.
 *   - Computes isOP and isMine.
 *
 * @param {Object} doc - Post or Comment document or plain object
 * @param {Object|string|null} viewer - The requesting user (req.user or userId string)
 * @param {Object} options - Additional context: { opAuthorId, threadId }
 * @returns {Object} Cleaned author object
 */
const serializeAuthor = (doc, viewer = null, options = {}) => {
  if (!doc) {
    return {
      _id: null,
      username: '[deleted]',
      avatar: null,
      isAnonymous: false,
      isOP: false,
      isMine: false,
    };
  }

  const rawAuthor = doc.author;
  const authorId = rawAuthor?._id
    ? rawAuthor._id.toString()
    : rawAuthor
    ? rawAuthor.toString()
    : null;

  const viewerId = viewer?._id
    ? viewer._id.toString()
    : viewer?.id
    ? viewer.id.toString()
    : typeof viewer === 'string'
    ? viewer
    : null;

  const isMine = Boolean(authorId && viewerId && authorId === viewerId);

  // Determine threadId for deterministic HMAC alias
  // If post doc: threadId is doc._id
  // If comment doc: threadId is doc.post
  let threadId = options.threadId;
  if (!threadId) {
    if (doc.post) {
      threadId = doc.post._id ? doc.post._id.toString() : doc.post.toString();
    } else if (doc._id) {
      threadId = doc._id.toString();
    }
  }

  // Determine if OP (Original Poster of the thread)
  let isOP = false;
  if (options.opAuthorId && authorId) {
    isOP = options.opAuthorId.toString() === authorId;
  } else if (!doc.post && doc._id) {
    // If it's the post itself, the post's author is the OP
    isOP = true;
  } else if (doc.post && doc.post.author && authorId) {
    const postAuthorId = doc.post.author._id
      ? doc.post.author._id.toString()
      : doc.post.author.toString();
    isOP = postAuthorId === authorId;
  }

  const isAnonymous = Boolean(doc.isAnonymous);

  if (isAnonymous) {
    const alias = getAnonymousAlias(authorId, threadId);
    return {
      _id: null, // Strictly prevent leaking author's ObjectId
      username: alias,
      alias,
      avatar: null,
      bio: '',
      karma: { post: 0, comment: 0, total: 0 },
      isAnonymous: true,
      isOP,
      isMine,
    };
  }

  // Non-anonymous author
  if (rawAuthor && typeof rawAuthor === 'object') {
    const rawUsername = rawAuthor.username || '';
    const username = rawUsername.startsWith('u/')
      ? rawUsername
      : rawUsername
      ? `u/${rawUsername}`
      : '[deleted]';
    return {
      _id: rawAuthor._id || authorId,
      username,
      avatar: rawAuthor.avatar || rawAuthor.profileImage || null,
      bio: rawAuthor.bio || '',
      karma: rawAuthor.karma || { post: 0, comment: 0, total: 0 },
      isAnonymous: false,
      isOP,
      isMine,
    };
  }

  return {
    _id: authorId,
    username: '[deleted]',
    avatar: null,
    bio: '',
    karma: { post: 0, comment: 0, total: 0 },
    isAnonymous: false,
    isOP,
    isMine,
  };
};

module.exports = { serializeAuthor };
