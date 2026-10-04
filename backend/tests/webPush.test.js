const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { sendPushNotification } = require('../services/pushService');
require('./setup');

describe('Web Push Notification System', () => {
  let token;
  let user;

  const mockEndpoint = 'https://fcm.googleapis.com/fcm/send/test-sub-token-123';
  const mockKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0P6c7-3GfGf7vH2F31QjC7w0n',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'push_tester',
      email: 'pushtest@college.edu',
      password: 'Password@123',
    });
    user = reg.body.data?.user;

    const login = await request(app).post('/api/auth/login').send({
      email: 'pushtest@college.edu',
      password: 'Password@123',
    });
    token = login.body.data?.accessToken;
  });

  afterAll(async () => {
    if (user) await User.findByIdAndDelete(user._id || user.id);
    await PushSubscription.deleteMany({ endpoint: mockEndpoint });
  });

  test('GET /api/notifications/push/vapid-key - Returns VAPID public key', async () => {
    const res = await request(app)
      .get('/api/notifications/push/vapid-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.publicKey).toBeDefined();
    expect(typeof res.body.data?.publicKey).toBe('string');
  });

  test('POST /api/notifications/push/subscribe - Registers a browser push subscription', async () => {
    const res = await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: mockEndpoint,
        keys: mockKeys,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const subInDb = await PushSubscription.findOne({ endpoint: mockEndpoint });
    expect(subInDb).toBeDefined();
    expect(subInDb.user.toString()).toBe(user._id || user.id);
    expect(subInDb.keys.auth).toBe(mockKeys.auth);
  });

  test('POST /api/notifications/push/subscribe - Rejects invalid subscription payload', async () => {
    const res = await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: mockEndpoint,
        // missing keys
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Push service - Handles dispatch to registered user', async () => {
    const result = await sendPushNotification(user._id || user.id, {
      title: 'Study Reminder',
      body: 'Calculus study group starts in 10 minutes',
    });

    expect(result).toBeDefined();
    expect(typeof result.sent).toBe('number');
    expect(typeof result.failed).toBe('number');
  });

  test('POST /api/notifications/push/unsubscribe - Removes browser push subscription', async () => {
    const res = await request(app)
      .post('/api/notifications/push/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: mockEndpoint });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const subInDb = await PushSubscription.findOne({ endpoint: mockEndpoint });
    expect(subInDb).toBeNull();
  });
});
