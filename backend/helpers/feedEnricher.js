const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const PollVote = require('../models/PollVote');
const { serializeAuthor } = require('./authorSerializer');

/**
 * Enriches a list of posts with voteStatus, savedByMe, and isOwner flags for a user.
 * It also strips any sensitive user data, formatting the author as a pseudonymous public profile or anonymous alias.
 * 
 * @param {Array} posts - Array of Mongoose Post documents or plain objects
 * @param {string|null} userId - The ID of the authenticated user (optional)
 * @returns {Array} List of enriched plain JSON post objects
 */
const enrichPosts = async (posts, userId) => {
  if (!posts || posts.length === 0) return [];

  // Convert mongoose documents to plain JSON objects
  const postObjects = posts.map((p) => {
    const obj = p.toObject ? p.toObject() : { ...p };
    
    // Centralized zero-leak serialization
    obj.author = serializeAuthor(obj, userId);
    delete obj.encryptedAuthor;

    // Format community display name / slug if populated
    if (obj.community && typeof obj.community === 'object') {
      obj.community = {
        _id: obj.community._id,
        name: obj.community.name,
        slug: obj.community.slug,
        displayName: obj.community.displayName,
        icon: obj.community.icon,
      };
    }

    return obj;
  });

  const postIds = postObjects.map((p) => p._id);

  const votesMap = new Map(); // postID -> vote value (1 / -1)
  const savedSet = new Set(); // set of saved postIDs
  const pollVoteMap = new Map(); // postID -> optionId string

  if (userId) {
    // 1. Bulk query all user votes on these posts
    const votes = await Vote.find({
      user: userId,
      targetType: 'post',
      targetId: { $in: postIds },
    });
    votes.forEach((v) => {
      votesMap.set(v.targetId.toString(), v.value);
    });

    // 2. Bulk query all saved posts for this user
    const saved = await SavedPost.find({
      user: userId,
      post: { $in: postIds },
    });
    saved.forEach((s) => {
      savedSet.add(s.post.toString());
    });

    // 3. Bulk query user poll votes on these posts
    const pollVotes = await PollVote.find({
      user: userId,
      post: { $in: postIds },
    });
    pollVotes.forEach((pv) => {
      pollVoteMap.set(pv.post.toString(), pv.optionId.toString());
    });
  }

  // 4. Inject flags
  postObjects.forEach((p) => {
    const postIdStr = p._id.toString();
    p.voteStatus = votesMap.get(postIdStr) || 0; // 1 (upvoted), -1 (downvoted), 0 (none)
    p.savedByMe = savedSet.has(postIdStr);
    p.isOwner = p.author ? Boolean(p.author.isMine) : false;
    p.userVotedOptionId = pollVoteMap.get(postIdStr) || null;
  });

  return postObjects;
};

module.exports = { enrichPosts };
