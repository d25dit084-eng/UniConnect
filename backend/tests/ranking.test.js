const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const {
  calculateHotRank,
  calculateRisingRank,
  calculateControversialRank,
  getTimeframeDate,
} = require('../services/rankingService');
require('./setup');

describe('Collegiate Engagement & Hot Ranking Algorithm', () => {
  let token;
  let user;
  let community;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'ranking_tester',
      email: 'ranking@college.edu',
      password: 'Password@123',
    });
    user = reg.body.data?.user;

    const login = await request(app).post('/api/auth/login').send({
      email: 'ranking@college.edu',
      password: 'Password@123',
    });
    token = login.body.data?.accessToken;

    community = await Community.create({
      name: 'ranking_comm',
      slug: 'ranking_comm',
      displayName: 'Ranking Test Community',
      description: 'Testing hot rank signals',
      creator: user._id || user.id,
    });
  });

  afterAll(async () => {
    if (user) await User.findByIdAndDelete(user._id || user.id);
    if (community) await Community.findByIdAndDelete(community._id);
    await Post.deleteMany({ community: community?._id });
  });

  describe('Pure Mathematical Formulas', () => {
    it('should assign higher hotRank to posts with higher vote score', () => {
      const now = new Date();
      const rankLow = calculateHotRank(5, 0, 0, now);
      const rankHigh = calculateHotRank(50, 0, 0, now);
      expect(rankHigh).toBeGreaterThan(rankLow);
    });

    it('should give higher hotRank to posts with comments given equal vote score', () => {
      const now = new Date();
      const rankNoComments = calculateHotRank(10, 0, 0, now);
      const rankWithComments = calculateHotRank(10, 0, 15, now);
      expect(rankWithComments).toBeGreaterThan(rankNoComments);
    });

    it('should decay hotRank over time (newer post ranks higher than older with same score)', () => {
      const now = new Date();
      const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
      const rankNew = calculateHotRank(20, 0, 5, now);
      const rankOld = calculateHotRank(20, 0, 5, twoDaysAgo);
      expect(rankNew).toBeGreaterThan(rankOld);
    });

    it('should maintain backwards compatibility with 3-arg signature (up, down, date)', () => {
      const now = new Date();
      const rank = calculateHotRank(10, 2, now);
      expect(typeof rank).toBe('number');
      expect(isNaN(rank)).toBe(false);
    });

    it('should score controversial content highest when upvotes and downvotes are balanced', () => {
      const balanced = calculateControversialRank(50, 50, 10);
      const oneSided = calculateControversialRank(100, 0, 10);
      expect(balanced).toBeGreaterThan(oneSided);
    });

    it('should calculate timeframe filter boundaries correctly', () => {
      const today = getTimeframeDate('today');
      expect(today).toBeInstanceOf(Date);
      expect(today.getTime()).toBeLessThan(Date.now());
      expect(Date.now() - today.getTime()).toBeCloseTo(24 * 60 * 60 * 1000, -3);

      expect(getTimeframeDate('all')).toBeNull();
    });
  });

  describe('Live Database & Feed Integration', () => {
    it('should update post hotRank automatically when comments are created', async () => {
      // Create a test post
      const post = await Post.create({
        title: 'Ranking Test Post',
        content: 'Testing hot rank update on comment addition',
        community: community._id,
        author: user._id || user.id,
        upvoteCount: 1,
        downvoteCount: 0,
        score: 1,
        commentCount: 0,
        hotRank: calculateHotRank(1, 0, 0, new Date()),
      });

      const initialHotRank = post.hotRank;

      // Add a comment
      const commentRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          postId: post._id.toString(),
          content: 'This discussion should boost the hot rank!',
        });

      expect(commentRes.status).toBe(201);

      // Verify post hotRank was recalculated and increased
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost.commentCount).toBe(1);
      expect(updatedPost.hotRank).toBeGreaterThan(initialHotRank);

      // Clean up
      await Comment.deleteMany({ post: post._id });
      await Post.findByIdAndDelete(post._id);
    });

    it('should filter feed by sort and timeframe parameters', async () => {
      const res = await request(app)
        .get('/api/feed/popular?sort=top&timeframe=today')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
    });
  });
});
