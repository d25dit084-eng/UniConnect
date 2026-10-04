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

  it('should report dependency monitoring with database ping and memory telemetry', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.database.status).toBe('healthy');
    expect(res.body.dependencies.database.type).toBe('mongodb');
    expect(typeof res.body.dependencies.database.latencyMs).toBe('number');
    expect(res.body.dependencies.redis).toBeDefined();
    expect(res.body.memory).toBeDefined();
    expect(typeof res.body.memory.heapUsedMB).toBe('number');
  });

  it('should include Helmet security headers and X-Request-Id tracing header', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
  });
});
