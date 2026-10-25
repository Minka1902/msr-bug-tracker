import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

export const sealSecret = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, config.encryptionKey, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, ...[iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url'))].join('.');
};

export const openSecret = (sealed: string) => {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unknown secret format');
  const decipher = createDecipheriv(ALGORITHM, config.encryptionKey, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
};
