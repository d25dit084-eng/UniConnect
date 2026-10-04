const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
require('./setup');

describe('Authentication & Security API', () => {
  const runId = Date.now();
  const testUser = {
    username: `jest_user_${runId}`,
    email: `jest_user_${runId}@uni.edu`,
    password: 'Password123!',
  };

  afterAll(async () => {
    await User.deleteMany({ email: new RegExp(`jest_user_${runId}`) });
  });

  it('should reject registration with invalid fields via Zod', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'a!', // Invalid characters + too short
      email: 'not-an-email',
      password: '123', // Too short, no special char
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('should register a valid user successfully', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.user._id).toBeDefined();
  });

  it('should login and return an access token and cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should lock account after 5 consecutive failed login attempts', async () => {
    const lockoutEmail = `lock_${runId}@uni.edu`;
    await User.create({
      username: `lock_${runId}`,
      email: lockoutEmail,
      password: 'Password123!',
    });

    // 4 failed attempts -> 401
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/auth/login').send({
        email: lockoutEmail,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    }

    // 5th failed attempt -> 429 Account Locked
    const lockRes = await request(app).post('/api/auth/login').send({
      email: lockoutEmail,
      password: 'WrongPassword!',
    });
    expect(lockRes.status).toBe(429);
    expect(lockRes.body.message).toMatch(/Account locked/i);

    // Clean up
    await User.deleteOne({ email: lockoutEmail });
  });
});
