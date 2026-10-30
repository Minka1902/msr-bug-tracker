import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { AwsClient } from 'aws4fetch';
import type { Request, Response } from 'express';
import { config } from '../config';
import { notFound } from './httpError';
import { logger } from './logger';

const DELETE_BATCH = 1000;
const FORWARDED_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since'];
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
];

export const TMP_DIR = path.join(config.uploadDir, 'tmp');

const r2 =
  config.r2 &&
  new AwsClient({
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
    service: 's3',
    region: 'auto',
    retries: 2,
  });

const objectUrl = (key: string) =>
  `${config.r2!.endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`;

const storagePath = (key: string) => {
  const resolved = path.resolve(config.uploadDir, key);
  if (!resolved.startsWith(config.uploadDir + path.sep)) throw new Error('Invalid storage key');
  return resolved;
};

const assertStored = async (response: globalThis.Response) => {
  if (!response.ok) throw new Error(`R2 responded ${response.status}: ${await response.text()}`);
};

const putObject = async (key: string, body: Buffer, mime: string) =>
  assertStored(await r2!.fetch(objectUrl(key), { method: 'PUT', body, headers: { 'Content-Type': mime } }));

const deleteObjects = async (keys: string[]) => {
  const body = `<Delete><Quiet>true</Quiet>${keys.map((key) => `<Object><Key>${key}</Key></Object>`).join('')}</Delete>`;
  await assertStored(
    await r2!.fetch(`${config.r2!.endpoint}?delete`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/xml',
        'Content-MD5': createHash('md5').update(body).digest('base64'),
      },
    }),
  );
};

export const ensureStorage = () => fs.mkdir(TMP_DIR, { recursive: true });

export const moveIntoStorage = async (tempPath: string, key: string, mime: string) => {
  if (r2) {
    await putObject(key, await fs.readFile(tempPath), mime);
    await fs.rm(tempPath, { force: true });
    return;
  }
  const target = storagePath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(tempPath, target);
};

export const copyIntoStorage = async (sourcePath: string, key: string, mime: string) => {
  if (r2) return putObject(key, await fs.readFile(sourcePath), mime);
  const target = storagePath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(sourcePath, target);
};

export const sendStored = async (req: Request, res: Response, key: string) => {
  if (!r2) {
    res.sendFile(storagePath(key));
    return;
  }
  const response = await r2.fetch(objectUrl(key), {
    headers: Object.fromEntries(
      FORWARDED_REQUEST_HEADERS.flatMap((name) =>
        typeof req.headers[name] === 'string' ? [[name, req.headers[name]]] : [],
      ),
    ),
  });
  if (response.status === 404) throw notFound('File not found');
  if (!response.ok && response.status !== 304) throw new Error(`R2 responded ${response.status}`);
  res.status(response.status);
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value && !res.hasHeader(name)) res.setHeader(name, value);
  }
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body as ReadableStream)
    .on('error', () => res.destroy())
    .pipe(res);
};

export const removeStored = async (keys: (string | null | undefined)[]) => {
  const present = keys.filter((key): key is string => !!key);
  if (!r2) {
    await Promise.all(
      present.map((key) =>
        fs
          .rm(storagePath(key), { force: true })
          .catch((err) => logger.warn({ err, key }, 'Failed to delete file')),
      ),
    );
    return;
  }
  await Promise.all(
    Array.from({ length: Math.ceil(present.length / DELETE_BATCH) }, (_, index) =>
      present.slice(index * DELETE_BATCH, (index + 1) * DELETE_BATCH),
    ).map((batch) =>
      deleteObjects(batch).catch((err) =>
        logger.warn({ err, files: batch.length }, 'Failed to delete files'),
      ),
    ),
  );
};
