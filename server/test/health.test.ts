import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('health', () => {
  it('responds ok and 404s unknown api routes', async () => {
    const app = createApp();
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true });
    expect((await request(app).get('/api/config')).body.features).toHaveProperty('demoData');
    expect((await request(app).get('/api/nope')).status).toBe(401);
  });
});
