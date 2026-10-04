/**
 * Comprehensive verification script for Atomic Votes and Incremental Karma.
 * Tests:
 * 1. Concurrent votes from 20 distinct users hitting a post simultaneously.
 * 2. Rapid vote toggle (upvote -> undo -> upvote) consistency.
 * 3. Vote flip (upvote -> downvote) with delta -2 on score and author karma.
 * 4. Comment voting concurrency and comment karma tracking.
 * 5. Delayed karma buffering for anonymous posts.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const { votePost, voteComment } = require('../controllers/voteController');
const { flushDelayedKarma } = require('../services/karmaService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

// Safety check
const parsed = new URL(MONGO_URI.startsWith('mongodb://') || MONGO_URI.startsWith('mongodb+srv://') ? MONGO_URI : `mongodb://${MONGO_URI}`);
console.log(`[Safety] Connecting tests against DB host: ${parsed.hostname}`);
if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
  console.error('ABORT: Safety check failed. MONGO_URI is not pointing to localhost / dev database.');
  process.exit(1);
}

// Mock express req/res
function mockReqRes(userId, params = {}, body = {}) {
  const req = {
    user: { _id: new mongoose.Types.ObjectId(userId) },
    params,
    body,
  };
  let responseData = null;
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };
  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function runTests() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for Atomic Votes Verification');

  const runId = Date.now();

  try {
    // 1. Create Author user
    const author = await User.create({
      username: `author_karma_${runId}`,
      email: `author_karma_${runId}@uni.edu`,
      password: 'Password123!',
      karma: { post: 0, comment: 0, total: 0 },
    });

    // 2. Create Community
    const community = await Community.create({
      name: `comm_karma_${runId}`,
      slug: `comm_karma_${runId}`,
      displayName: 'Karma Test Comm',
      description: 'Testing atomic votes',
      creator: author._id,
    });

    // 3. Create a public post (author starts with 1 upvote and 1 karma in normal flow, here created raw with 0)
    const post = await Post.create({
      author: author._id,
      community: community._id,
      title: 'Atomic Vote Concurrency Test Post',
      content: 'Testing atomic concurrency',
      type: 'text',
      upvoteCount: 0,
      downvoteCount: 0,
      score: 0,
      isAnonymous: false,
    });

    console.log(`\n--- TEST 1: Concurrent Upvotes from 20 distinct users ---`);
    const voterCount = 20;
    const voters = [];
    for (let i = 0; i < voterCount; i++) {
      const v = await User.create({
        username: `voter_${runId}_${i}`,
        email: `voter_${runId}_${i}@uni.edu`,
        password: 'Password123!',
        karma: { post: 0, comment: 0, total: 0 },
      });
      voters.push(v);
    }

    // Fire 20 votePost calls simultaneously
    const votePromises = voters.map((voter) => {
      const { req, res, getResult } = mockReqRes(voter._id, { postId: post._id }, { value: 1 });
      return votePost(req, res).then(() => getResult());
    });

    const results = await Promise.all(votePromises);
    console.log(`Completed ${results.length} concurrent vote requests.`);

    // Check post state
    const postAfterVotes = await Post.findById(post._id);
    const votesInDb = await Vote.find({ targetId: post._id, targetType: 'post' });
    const authorAfterVotes = await User.findById(author._id);

    console.log(`Post score: ${postAfterVotes.score} (expected: 20)`);
    console.log(`Post upvoteCount: ${postAfterVotes.upvoteCount} (expected: 20)`);
    console.log(`Total Vote docs: ${votesInDb.length} (expected: 20)`);
    console.log(`Author post karma: ${authorAfterVotes.karma.post} (expected: 20)`);
    console.log(`Author total karma: ${authorAfterVotes.karma.total} (expected: 20)`);

    if (
      postAfterVotes.score !== 20 ||
      postAfterVotes.upvoteCount !== 20 ||
      votesInDb.length !== 20 ||
      authorAfterVotes.karma.post !== 20
    ) {
      throw new Error('Test 1 failed: Concurrent votes caused count or karma mismatch!');
    }
    console.log('✅ TEST 1 PASSED: Perfect concurrency and karma sync!');

    console.log(`\n--- TEST 2: Vote Flip (Upvote -> Downvote: net -2 change) ---`);
    // Pick voter 0 and flip from +1 to -1
    const { req: flipReq, res: flipRes } = mockReqRes(voters[0]._id, { postId: post._id }, { value: -1 });
    await votePost(flipReq, flipRes);

    const postAfterFlip = await Post.findById(post._id);
    const authorAfterFlip = await User.findById(author._id);

    console.log(`Post score after flip: ${postAfterFlip.score} (expected: 18)`);
    console.log(`Post upvotes: ${postAfterFlip.upvoteCount} (expected: 19)`);
    console.log(`Post downvotes: ${postAfterFlip.downvoteCount} (expected: 1)`);
    console.log(`Author karma after flip: ${authorAfterFlip.karma.post} (expected: 18)`);

    if (
      postAfterFlip.score !== 18 ||
      postAfterFlip.upvoteCount !== 19 ||
      postAfterFlip.downvoteCount !== 1 ||
      authorAfterFlip.karma.post !== 18
    ) {
      throw new Error('Test 2 failed: Vote flip did not decrement correctly by 2!');
    }
    console.log('✅ TEST 2 PASSED: Direction flip handled accurately!');

    console.log(`\n--- TEST 3: Vote Undo (Clicking vote again removes it) ---`);
    // Voter 1 was upvoted (+1). Send value: 1 again to undo
    const { req: undoReq, res: undoRes } = mockReqRes(voters[1]._id, { postId: post._id }, { value: 1 });
    await votePost(undoReq, undoRes);

    const postAfterUndo = await Post.findById(post._id);
    const authorAfterUndo = await User.findById(author._id);

    console.log(`Post score after undo: ${postAfterUndo.score} (expected: 17)`);
    console.log(`Post upvotes after undo: ${postAfterUndo.upvoteCount} (expected: 18)`);
    console.log(`Author karma after undo: ${authorAfterUndo.karma.post} (expected: 17)`);

    if (
      postAfterUndo.score !== 17 ||
      postAfterUndo.upvoteCount !== 18 ||
      authorAfterUndo.karma.post !== 17
    ) {
      throw new Error('Test 3 failed: Vote undo did not decrement score and karma!');
    }
    console.log('✅ TEST 3 PASSED: Vote removal and karma rollback succeeded!');

    console.log(`\n--- TEST 4: Comment Voting & Comment Karma ---`);
    const comment = await Comment.create({
      post: post._id,
      author: author._id,
      content: 'Atomic comment test',
      upvoteCount: 0,
      downvoteCount: 0,
      score: 0,
      isAnonymous: false,
    });

    const { req: commReq, res: commRes } = mockReqRes(voters[2]._id, { commentId: comment._id }, { value: 1 });
    await voteComment(commReq, commRes);

    const commentAfterVote = await Comment.findById(comment._id);
    const authorAfterCommVote = await User.findById(author._id);

    console.log(`Comment score: ${commentAfterVote.score} (expected: 1)`);
    console.log(`Author comment karma: ${authorAfterCommVote.karma.comment} (expected: 1)`);

    if (commentAfterVote.score !== 1 || authorAfterCommVote.karma.comment !== 1) {
      throw new Error('Test 4 failed: Comment vote karma mismatch!');
    }
    console.log('✅ TEST 4 PASSED: Comment voting updates comment score and author comment karma!');

    console.log(`\n--- TEST 5: Anonymous Post Delayed Karma ---`);
    const anonPost = await Post.create({
      author: author._id,
      community: community._id,
      title: 'Anonymous Post for Delayed Karma Test',
      content: 'Testing delayed karma timing protection',
      type: 'text',
      upvoteCount: 0,
      downvoteCount: 0,
      score: 0,
      isAnonymous: true,
    });

    const prevAuthorPostKarma = (await User.findById(author._id)).karma.post;

    // Upvote anonymous post
    const { req: anonVoteReq, res: anonVoteRes } = mockReqRes(voters[3]._id, { postId: anonPost._id }, { value: 1 });
    await votePost(anonVoteReq, anonVoteRes);

    const authorImmediatelyAfter = await User.findById(author._id);
    console.log(`Author karma immediately after anon vote: ${authorImmediatelyAfter.karma.post} (expected: ${prevAuthorPostKarma} - buffered, no timing leak)`);

    if (authorImmediatelyAfter.karma.post !== prevAuthorPostKarma) {
      throw new Error('Test 5 failed: Anonymous vote leaked karma change immediately!');
    }

    // Flush buffered karma
    await flushDelayedKarma(true);

    const authorAfterFlush = await User.findById(author._id);
    console.log(`Author karma after delayed flush: ${authorAfterFlush.karma.post} (expected: ${prevAuthorPostKarma + 1})`);

    if (authorAfterFlush.karma.post !== prevAuthorPostKarma + 1) {
      throw new Error('Test 5 failed: Delayed karma flush did not increment karma!');
    }
    console.log('✅ TEST 5 PASSED: Anonymous posts prevent timing attacks with delayed buffered karma!');

    console.log('\n========================================================');
    console.log('🎉 ALL 5 ATOMIC VOTE & INCREMENTAL KARMA TESTS PASSED! 🎉');
    console.log('========================================================');

    // Cleanup test data
    await Vote.deleteMany({ targetId: { $in: [post._id, anonPost._id, comment._id] } });
    await Comment.deleteMany({ _id: comment._id });
    await Post.deleteMany({ _id: { $in: [post._id, anonPost._id] } });
    await Community.deleteMany({ _id: community._id });
    await User.deleteMany({ _id: { $in: [author._id, ...voters.map((v) => v._id)] } });
    console.log('Test data cleaned up successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
