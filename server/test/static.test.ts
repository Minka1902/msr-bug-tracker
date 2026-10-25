import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('client static files', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'msr-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>shell</title>');
    fs.writeFileSync(path.join(dist, 'sw.js'), 'self.skipWaiting()');
    fs.writeFileSync(path.join(dist, 'assets', 'index-abc.js'), 'console.log(1)');
    app = createApp({ clientDist: dist });
  });

  it('caches hashed assets forever', async () => {
    const res = await request(app).get('/assets/index-abc.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('revalidates the service worker and other root files', async () => {
    const res = await request(app).get('/sw.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('404s a missing hashed asset instead of serving the shell', async () => {
    const res = await request(app).get('/assets/index-old.js');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('shell');
  });

  it('serves the shell for client routes', async () => {
    const res = await request(app).get('/p/WEB/board');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.text).toContain('shell');
  });
});
