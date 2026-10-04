const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const PollVote = require('../models/PollVote');
require('./setup');

describe('Polls in Posts Engine', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let community;
  let pollPost;

  beforeAll(async () => {
    // Register User A
    const regA = await request(app).post('/api/auth/register').send({
      username: 'poll_user_a',
      email: 'poll_a@college.edu',
      password: 'Password@123',
    });
    userA = regA.body.data?.user;

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'poll_a@college.edu',
      password: 'Password@123',
    });
    tokenA = loginA.body.data?.accessToken;

    // Register User B
    const regB = await request(app).post('/api/auth/register').send({
      username: 'poll_user_b',
      email: 'poll_b@college.edu',
      password: 'Password@123',
    });
    userB = regB.body.data?.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'poll_b@college.edu',
      password: 'Password@123',
    });
    tokenB = loginB.body.data?.accessToken;

    // Create community
    community = await Community.create({
      name: 'poll-community',
      slug: 'poll-community',
      displayName: 'Poll Community',
      description: 'Testing polls',
      creator: userA._id || userA.id,
    });
  });

  afterAll(async () => {
    if (userA) await User.findByIdAndDelete(userA._id || userA.id);
    if (userB) await User.findByIdAndDelete(userB._id || userB.id);
    if (community) await Community.findByIdAndDelete(community._id);
    if (pollPost) await Post.findByIdAndDelete(pollPost._id);
    await PollVote.deleteMany({});
  });

  it('should create an interactive poll post with options', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        communityId: community._id.toString(),
        type: 'poll',
        title: 'Which campus dining hall has the best breakfast?',
        poll: {
          question: 'Best breakfast on campus?',
          options: ['North Hall', 'South Quad Cafe', 'Engineering Hub'],
          durationDays: 3,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    pollPost = res.body.data?.post || res.body.post;
    expect(pollPost.type).toBe('poll');
    expect(pollPost.poll.options.length).toBe(3);
    expect(pollPost.poll.totalVotes).toBe(0);
  });

  it('should record an atomic poll vote and increment vote counts', async () => {
    const optionToVote = pollPost.poll.options[0];

    const res = await request(app)
      .post(`/api/posts/${pollPost._id}/poll/vote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        optionId: optionToVote._id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updatedPoll = res.body.data?.poll || res.body.poll;
    expect(updatedPoll.totalVotes).toBe(1);

    const votedOpt = updatedPoll.options.find((o) => o._id === optionToVote._id);
    expect(votedOpt.voteCount).toBe(1);
  });

  it('should reject duplicate vote by the same user on the same poll', async () => {
    const optionToVote = pollPost.poll.options[1];

    const res = await request(app)
      .post(`/api/posts/${pollPost._id}/poll/vote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        optionId: optionToVote._id,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should allow another user to vote and reflect in feed enrichment', async () => {
    const optionToVote = pollPost.poll.options[1];

    const res = await request(app)
      .post(`/api/posts/${pollPost._id}/poll/vote`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        optionId: optionToVote._id,
      });

    expect(res.status).toBe(200);
    const updatedPoll = res.body.data?.poll || res.body.poll;
    expect(updatedPoll.totalVotes).toBe(2);

    // Verify enrichment for User B
    const postRes = await request(app)
      .get(`/api/posts/${pollPost._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(postRes.status).toBe(200);
    const postData = postRes.body.data?.post || postRes.body.post;
    expect(postData.userVotedOptionId).toBe(optionToVote._id.toString());
  });

  it('should reject votes on an expired poll', async () => {
    // Create an expired poll
    const expiredPost = await Post.create({
      author: userA._id || userA.id,
      community: community._id,
      type: 'poll',
      title: 'Expired election poll',
      poll: {
        question: 'Who won?',
        options: [
          { text: 'Option 1', voteCount: 0 },
          { text: 'Option 2', voteCount: 0 },
        ],
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
        totalVotes: 0,
      },
    });

    const res = await request(app)
      .post(`/api/posts/${expiredPost._id}/poll/vote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        optionId: expiredPost.poll.options[0]._id,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('ended');

    await Post.findByIdAndDelete(expiredPost._id);
  });
});
