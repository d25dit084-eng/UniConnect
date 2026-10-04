const request = require('supertest');
const app = require('../app');
require('./setup');

describe('API Documentation (Swagger UI & OpenAPI 3.0)', () => {
  it('should serve OpenAPI 3.0 JSON specification at /api/docs/json', async () => {
    const res = await request(app).get('/api/docs/json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('UniConnect');
    expect(res.body.paths['/api/health']).toBeDefined();
    expect(res.body.paths['/api/auth/login']).toBeDefined();
    expect(res.body.paths['/api/posts']).toBeDefined();
    expect(res.body.components.schemas.Post).toBeDefined();
  });

  it('should serve Swagger UI documentation interface at /api/docs/', async () => {
    const res = await request(app).get('/api/docs/');

    // Swagger UI either returns 200 HTML or 301 redirect
    expect([200, 301]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toContain('swagger-ui');
    }
  });
});
