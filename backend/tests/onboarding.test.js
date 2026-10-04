const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
require('./setup');

describe('User Onboarding Flow', () => {
  let token;
  let userId;
  let testCommunity;

  beforeAll(async () => {
    testCommunity = await Community.create({
      name: 'onboarding-test-club',
      displayName: 'Onboarding Test Club',
      slug: 'onboarding-test-club',
      description: 'Test community for onboarding',
      creator: new User()._id,
    });

    const reg = await request(app).post('/api/auth/register').send({
      username: 'new_student_2026',
      email: 'newstudent@college.edu',
      password: 'Password@123',
    });
    userId = reg.body.data?.user?._id || reg.body.data?.user?.id;

    const login = await request(app).post('/api/auth/login').send({
      email: 'newstudent@college.edu',
      password: 'Password@123',
    });
    token = login.body.data?.accessToken;
  });

  afterAll(async () => {
    if (userId) await User.findByIdAndDelete(userId);
    if (testCommunity) await Community.findByIdAndDelete(testCommunity._id);
  });

  test('GET /api/users/me - Initial user has isOnboarded = false', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.isOnboarded).toBe(false);
  });

  test('POST /api/users/onboarding - Successfully completes onboarding and auto-joins communities', async () => {
    const res = await request(app)
      .post('/api/users/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        department: 'Computer Science',
        year: 2,
        interests: ['ai', 'hackathons', 'gaming'],
        bio: 'Sophomore CS student passionate about systems & AI.',
        communities: [testCommunity._id],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.department).toBe('Computer Science');
    expect(res.body.data.user.year).toBe(2);
    expect(res.body.data.user.interests).toContain('hackathons');
    expect(res.body.data.user.isOnboarded).toBe(true);

    // Verify community membership was created
    const CommunityMember = require('../models/CommunityMember');
    const memberRecord = await CommunityMember.findOne({
      community: testCommunity._id,
      user: userId,
    });
    expect(memberRecord).toBeDefined();
    expect(memberRecord.role).toBe('member');
  });

  test('GET /api/users/me - Reflects isOnboarded = true after completion', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.isOnboarded).toBe(true);
    expect(res.body.data.user.department).toBe('Computer Science');
    expect(res.body.data.user.year).toBe(2);
  });
});
