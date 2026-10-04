const request = require('supertest');
const app = require('../app');
require('./setup');

describe('GET /api/health', () => {
  it('should return server status, database state, and event loop metrics', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.server).toBe('running');
    expect(res.body.database).toBe('connected');
    expect(res.body.eventLoop).toBeDefined();
    expect(typeof res.body.eventLoop.p95LagMs).toBe('number');
  });

  it('should include Helmet security headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
