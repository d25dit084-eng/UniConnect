const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
require('./setup');

describe('Notification Preferences & Email Digest API', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'pref_tester',
      email: 'preftester@college.edu',
      password: 'Password@123',
    });
    userId = reg.body.data?.user?._id || reg.body.data?.user?.id;

    const login = await request(app).post('/api/auth/login').send({
      email: 'preftester@college.edu',
      password: 'Password@123',
    });
    token = login.body.data?.accessToken;
  });

  afterAll(async () => {
    if (userId) await User.findByIdAndDelete(userId);
  });

  test('GET /api/users/preferences/notifications - Returns default notification preferences', async () => {
    const res = await request(app)
      .get('/api/users/preferences/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.preferences).toBeDefined();
    expect(res.body.data.preferences.emailNotifications).toBe(true);
    expect(res.body.data.preferences.emailDigest).toBe('daily');
  });

  test('PUT /api/users/preferences/notifications - Updates user notification preferences', async () => {
    const res = await request(app)
      .put('/api/users/preferences/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        emailDigest: 'weekly',
        eventRsvp: false,
        mentions: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.preferences.emailDigest).toBe('weekly');
    expect(res.body.data.preferences.eventRsvp).toBe(false);
    expect(res.body.data.preferences.mentions).toBe(true);
  });

  test('POST /api/users/preferences/notifications/digest - Compiles and triggers digest successfully', async () => {
    const res = await request(app)
      .post('/api/users/preferences/notifications/digest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sent).toBe(true);
    expect(res.body.data.digest).toBeDefined();
    expect(res.body.data.digest.user.email).toBe('preftester@college.edu');
  });
});
