const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
require('./setup');

describe('Anonymity Engine Integration', () => {
  const runId = Date.now();
  let authorToken, viewerToken;
  let authorId, viewerId;
  let community;

  beforeAll(async () => {
    // Register author
    const authorRes = await request(app).post('/api/auth/register').send({
      username: `anon_author_${runId}`,
      email: `anon_author_${runId}@uni.edu`,
      password: 'Password123!',
    });
    authorId = authorRes.body.data.user._id;

    const authorLogin = await request(app).post('/api/auth/login').send({
      email: `anon_author_${runId}@uni.edu`,
      password: 'Password123!',
    });
    authorToken = authorLogin.body.data.accessToken;

    // Register viewer
    const viewerRes = await request(app).post('/api/auth/register').send({
      username: `anon_viewer_${runId}`,
      email: `anon_viewer_${runId}@uni.edu`,
      password: 'Password123!',
    });
    viewerId = viewerRes.body.data.user._id;

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: `anon_viewer_${runId}@uni.edu`,
      password: 'Password123!',
    });
    viewerToken = viewerLogin.body.data.accessToken;

    // Create community
    community = await Community.create({
      name: `comm_anon_${runId}`,
      slug: `comm_anon_${runId}`,
      displayName: 'Anon Test Community',
      description: 'Testing zero leaks',
      creator: authorId,
    });
  });

  afterAll(async () => {
    await Post.deleteMany({ community: community._id });
    await Community.deleteOne({ _id: community._id });
    await User.deleteMany({ _id: { $in: [authorId, viewerId] } });
  });

  it('should create an anonymous post and hide author details from third-party viewer', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        communityId: community._id.toString(),
        title: 'Confession: UniConnect is blazing fast',
        content: 'Zero identity leaks guaranteed',
        isAnonymous: true,
      });

    expect(createRes.status).toBe(201);
    const post = createRes.body.data.post;
    expect(post.isAnonymous).toBe(true);

    // Fetch as viewer
    const fetchRes = await request(app)
      .get(`/api/posts/${post._id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(fetchRes.status).toBe(200);
    const viewerPost = fetchRes.body.data.post;

    // Guaranteed zero identity leaks:
    // 1. Author object does NOT have author._id matching actual authorId
    // 2. Author object has alias (e.g. Anon-xxxx)
    // 3. isMine is false for viewer
    expect(viewerPost.author._id).not.toBe(authorId);
    expect(viewerPost.author.isMine).toBe(false);
    expect(typeof viewerPost.author.alias).toBe('string');
    expect(viewerPost.author.alias.length).toBeGreaterThan(0);
    expect(viewerPost.author.username).not.toBe(`anon_author_${runId}`);
  });
});
