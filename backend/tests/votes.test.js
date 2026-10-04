const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const Vote = require('../models/Vote');
require('./setup');

describe('Atomic Voting & Karma Integration', () => {
  const runId = Date.now();
  let authorToken, voterToken;
  let authorId, voterId;
  let community, post;

  beforeAll(async () => {
    const authorRes = await request(app).post('/api/auth/register').send({
      username: `vote_author_${runId}`,
      email: `vote_author_${runId}@uni.edu`,
      password: 'Password123!',
    });
    authorId = authorRes.body.data.user._id;

    const authorLogin = await request(app).post('/api/auth/login').send({
      email: `vote_author_${runId}@uni.edu`,
      password: 'Password123!',
    });
    authorToken = authorLogin.body.data.accessToken;

    const voterRes = await request(app).post('/api/auth/register').send({
      username: `voter_jest_${runId}`,
      email: `voter_jest_${runId}@uni.edu`,
      password: 'Password123!',
    });
    voterId = voterRes.body.data.user._id;

    const voterLogin = await request(app).post('/api/auth/login').send({
      email: `voter_jest_${runId}@uni.edu`,
      password: 'Password123!',
    });
    voterToken = voterLogin.body.data.accessToken;

    community = await Community.create({
      name: `comm_vote_${runId}`,
      slug: `comm_vote_${runId}`,
      displayName: 'Vote Test Community',
      description: 'Testing voting',
      creator: authorId,
    });

    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        communityId: community._id.toString(),
        title: 'Post to test atomic voting',
        content: 'Content for voting',
      });
    post = postRes.body.data.post;
  });

  afterAll(async () => {
    await Vote.deleteMany({ targetId: post._id });
    await Post.deleteOne({ _id: post._id });
    await Community.deleteOne({ _id: community._id });
    await User.deleteMany({ _id: { $in: [authorId, voterId] } });
  });

  it('should upvote a post, increment score and author karma', async () => {
    const voteRes = await request(app)
      .post(`/api/votes/posts/${post._id}`)
      .set('Authorization', `Bearer ${voterToken}`)
      .send({ value: 1 });

    expect(voteRes.status).toBe(200);
    // Post started with 1 self-upvote; voter makes it 2
    expect(voteRes.body.data.score).toBe(2);
    expect(voteRes.body.data.voteStatus).toBe(1);

    const updatedAuthor = await User.findById(authorId);
    // Author started with 1 karma; now has 2
    expect(updatedAuthor.karma.post).toBe(2);
  });

  it('should flip vote from upvote to downvote, adjusting score by -2', async () => {
    const flipRes = await request(app)
      .post(`/api/votes/posts/${post._id}`)
      .set('Authorization', `Bearer ${voterToken}`)
      .send({ value: -1 });

    expect(flipRes.status).toBe(200);
    // Score dropped from 2 to 0
    expect(flipRes.body.data.score).toBe(0);
    expect(flipRes.body.data.voteStatus).toBe(-1);

    const updatedAuthor = await User.findById(authorId);
    expect(updatedAuthor.karma.post).toBe(0);
  });

  it('should undo vote when clicking the same vote again', async () => {
    const undoRes = await request(app)
      .post(`/api/votes/posts/${post._id}`)
      .set('Authorization', `Bearer ${voterToken}`)
      .send({ value: -1 });

    expect(undoRes.status).toBe(200);
    // Undo downvote: score rises from 0 back to 1 (author's own initial vote)
    expect(undoRes.body.data.score).toBe(1);
    expect(undoRes.body.data.voteStatus).toBe(0);

    const updatedAuthor = await User.findById(authorId);
    expect(updatedAuthor.karma.post).toBe(1);
  });
});
