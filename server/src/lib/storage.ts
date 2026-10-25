import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { logger } from './logger';

export const TMP_DIR = path.join(config.uploadDir, 'tmp');

export const storagePath = (key: string) => {
  const resolved = path.resolve(config.uploadDir, key);
  if (!resolved.startsWith(config.uploadDir + path.sep)) throw new Error('Invalid storage key');
  return resolved;
};

export const ensureStorage = () => fs.mkdir(TMP_DIR, { recursive: true });

export const moveIntoStorage = async (tempPath: string, key: string) => {
  const target = storagePath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(tempPath, target);
};

export const copyIntoStorage = async (sourcePath: string, key: string) => {
  const target = storagePath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(sourcePath, target);
};

export const removeStored = async (keys: (string | null | undefined)[]) => {
  await Promise.all(
    keys
      .filter((key): key is string => !!key)
      .map((key) =>
        fs
          .rm(storagePath(key), { force: true })
          .catch((err) => logger.warn({ err, key }, 'Failed to delete file')),
      ),
  );
};
