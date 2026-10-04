const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
require('./setup');

describe('User Mentions & Autocomplete Engine', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let community;

  beforeAll(async () => {
    // User A (Sender)
    const regA = await request(app).post('/api/auth/register').send({
      username: 'mention_alice',
      email: 'alice_mention@college.edu',
      password: 'Password@123',
    });
    userA = regA.body.data?.user;

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'alice_mention@college.edu',
      password: 'Password@123',
    });
    tokenA = loginA.body.data?.accessToken;

    // User B (Recipient)
    const regB = await request(app).post('/api/auth/register').send({
      username: 'mention_bob',
      email: 'bob_mention@college.edu',
      password: 'Password@123',
    });
    userB = regB.body.data?.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'bob_mention@college.edu',
      password: 'Password@123',
    });
    tokenB = loginB.body.data?.accessToken;

    community = await Community.create({
      name: 'mention_comm',
      slug: 'mention_comm',
      displayName: 'Mention Community',
      description: 'Community for testing mentions',
      creator: userA._id || userA.id,
    });
  });

  afterAll(async () => {
    if (userA) await User.findByIdAndDelete(userA._id || userA.id);
    if (userB) await User.findByIdAndDelete(userB._id || userB.id);
    if (community) await Community.findByIdAndDelete(community._id);
    await Post.deleteMany({ community: community?._id });
    await Notification.deleteMany({
      $or: [
        { recipient: userA?._id || userA?.id },
        { recipient: userB?._id || userB?.id },
      ],
    });
  });

  it('should return matching users via GET /api/users/autocomplete without leaking private fields', async () => {
    const res = await request(app).get('/api/users/autocomplete?q=mention_b');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    const found = res.body.data.users.find((u) => u.rawUsername === 'mention_bob');
    expect(found).toBeDefined();
    expect(found.username).toContain('mention_bob');
    expect(found.email).toBeUndefined();
    expect(found.password).toBeUndefined();
  });

  it('should create a mention notification when a user is tagged in a public post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        communityId: community._id.toString(),
        title: 'Hey @mention_bob check this out!',
        content: 'We need your feedback on the midterm.',
        isAnonymous: false,
      });

    expect(res.status).toBe(201);
    const postId = res.body.data.post._id;

    // Check notification for userB
    const notif = await Notification.findOne({
      recipient: userB._id || userB.id,
      type: 'mention',
      post: postId,
    });

    expect(notif).toBeDefined();
    expect(notif.actor.toString()).toBe((userA._id || userA.id).toString());
    expect(notif.message).toContain('u/mention_alice mentioned you');
  });

  it('should create an anonymous mention notification with zero actor identity leaks', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        communityId: community._id.toString(),
        title: 'Secret shoutout to @mention_bob',
        content: 'Great presentation earlier today!',
        isAnonymous: true,
      });

    expect(res.status).toBe(201);
    const postId = res.body.data.post._id;

    // Check notification for userB
    const notif = await Notification.findOne({
      recipient: userB._id || userB.id,
      type: 'mention',
      post: postId,
    });

    expect(notif).toBeDefined();
    expect(notif.actor).toBeNull();
    expect(notif.message).toContain('Someone mentioned you in an anonymous post');
    expect(notif.message).not.toContain('mention_alice');
  });

  it('should not dispatch self-notifications when a user mentions herself', async () => {
    const beforeCount = await Notification.countDocuments({
      recipient: userA._id || userA.id,
      type: 'mention',
    });

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        communityId: community._id.toString(),
        title: 'Note to self: @mention_alice remember homework',
        content: 'Self reminder',
        isAnonymous: false,
      });

    expect(res.status).toBe(201);

    const afterCount = await Notification.countDocuments({
      recipient: userA._id || userA.id,
      type: 'mention',
    });

    expect(afterCount).toBe(beforeCount);
  });

  it('should dispatch mention notification when tagged in a comment', async () => {
    // User A makes a post
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        communityId: community._id.toString(),
        title: 'Study Session Discussion',
        content: 'When is everyone free?',
      });

    const postId = postRes.body.data.post._id;

    // User A tags User B in a comment
    const commentRes = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        postId,
        content: 'Are you coming @mention_bob?',
      });

    expect(commentRes.status).toBe(201);
    const commentId = commentRes.body.data.comment._id;

    const notif = await Notification.findOne({
      recipient: userB._id || userB.id,
      type: 'mention',
      comment: commentId,
    });

    expect(notif).toBeDefined();
    expect(notif.message).toContain('comment');
  });
});
