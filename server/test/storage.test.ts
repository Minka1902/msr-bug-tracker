import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const R2 = {
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'files',
};
const BUCKET_URL = 'https://account.r2.cloudflarestorage.com/files';

const r2Storage = async () => {
  vi.resetModules();
  Object.entries(R2).forEach(([name, value]) => vi.stubEnv(name, value));
  return import('../src/lib/storage');
};

const serving = async (storage: Awaited<ReturnType<typeof r2Storage>>) => {
  const { errorHandler } = await import('../src/middleware/errorHandler');
  return express()
    .get('/files/*key', (req, res) => {
      res.setHeader('Content-Type', 'image/png');
      return storage.sendStored(req, res, (req.params as { key: string[] }).key.join('/'));
    })
    .use(errorHandler);
};

let fetchMock: ReturnType<typeof vi.fn<(input: Request) => Promise<Response>>>;
const sent = (call = 0) => fetchMock.mock.calls[call]![0];

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('file storage on R2', () => {
  it('uploads a signed PUT with the file type and removes the temp file', async () => {
    const storage = await r2Storage();
    const temp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'r2-')), 'upload');
    await fs.writeFile(temp, 'png-bytes');
    await storage.moveIntoStorage(temp, 'attachments/2026-10/shot.png', 'image/png');

    expect(sent().method).toBe('PUT');
    expect(sent().url).toBe(`${BUCKET_URL}/attachments/2026-10/shot.png`);
    expect(sent().headers.get('content-type')).toBe('image/png');
    expect(sent().headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=access\/\d{8}\/auto\/s3\//,
    );
    expect(await sent().text()).toBe('png-bytes');
    await expect(fs.access(temp)).rejects.toThrow();
  });

  it('fails the upload when R2 refuses it', async () => {
    const storage = await r2Storage();
    const temp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'r2-')), 'upload');
    await fs.writeFile(temp, 'x');
    fetchMock.mockResolvedValue(new Response('<Error>AccessDenied</Error>', { status: 403 }));
    await expect(storage.moveIntoStorage(temp, 'attachments/x.png', 'image/png')).rejects.toThrow(
      /R2 responded 403/,
    );
  });

  it('streams a file back, passing ranges through and keeping the route headers', async () => {
    const app = await serving(await r2Storage());
    fetchMock.mockResolvedValue(
      new Response('ng', {
        status: 206,
        headers: {
          'content-type': 'application/octet-stream',
          'content-range': 'bytes 1-2/3',
          'content-length': '2',
          etag: '"abc"',
        },
      }),
    );
    const response = await request(app).get('/files/attachments/shot.png').set('Range', 'bytes=1-2');

    expect(sent().headers.get('range')).toBe('bytes=1-2');
    expect(response.status).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 1-2/3');
    expect(response.headers.etag).toBe('"abc"');
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.body.toString()).toBe('ng');
  });

  it('answers 404 for a file R2 does not have', async () => {
    const app = await serving(await r2Storage());
    fetchMock.mockResolvedValue(new Response('<Error>NoSuchKey</Error>', { status: 404 }));
    await request(app).get('/files/attachments/gone.png').expect(404);
  });

  it('deletes files in batches of 1000 with one request each', async () => {
    const storage = await r2Storage();
    const keys = Array.from({ length: 1001 }, (_, index) => `attachments/${index}.png`);
    await storage.removeStored([...keys, null, undefined]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent().method).toBe('POST');
    expect(sent().url).toBe(`${BUCKET_URL}?delete`);
    expect(sent().headers.get('content-md5')).toBeTruthy();
    const bodies = await Promise.all([sent(0).text(), sent(1).text()]);
    expect(bodies.map((body) => body.match(/<Key>/g)!.length).sort((a, b) => a - b)).toEqual([1, 1000]);
  });
});
