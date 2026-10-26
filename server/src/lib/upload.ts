import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import multer from 'multer';
import { HttpError } from './httpError';
import { moveIntoStorage, removeStored, TMP_DIR } from './storage';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const ATTACHMENT_TYPES = new Set([
  ...IMAGE_TYPES,
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/zip',
  'text/plain',
]);

const TEXT_EXTENSIONS = new Set(['.txt', '.log', '.csv', '.json', '.md', '.har']);
const TEXT_SNIFF_BYTES = 8192;

export interface StoredFile {
  key: string;
  mime: string;
  ext: string;
  size: number;
  name: string;
}

export const uploadFiles = (field: string, maxBytes: number, maxFiles: number) =>
  multer({ dest: TMP_DIR, limits: { fileSize: maxBytes, files: maxFiles } }).array(field, maxFiles);

const looksLikeText = async (filePath: string) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(TEXT_SNIFF_BYTES), 0, TEXT_SNIFF_BYTES, 0);
    const sample = buffer.subarray(0, bytesRead);
    return (
      !sample.includes(0) && new TextDecoder('utf-8', { fatal: false }).decode(sample).indexOf('�') === -1
    );
  } finally {
    await handle.close();
  }
};

const detectType = async (file: Express.Multer.File) => {
  const detected = await fileTypeFromFile(file.path);
  if (detected) return { mime: detected.mime, ext: `.${detected.ext}` };
  const ext = path.extname(file.originalname).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext) && (await looksLikeText(file.path))) return { mime: 'text/plain', ext };
  return null;
};

const decodeName = (name: string) => {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
};

export const discardTemp = (files: Express.Multer.File[] = []) =>
  Promise.all(files.map((file) => fs.rm(file.path, { force: true })));

export const storeUploads = async (
  files: Express.Multer.File[],
  allowed: Set<string>,
  folder: string,
): Promise<StoredFile[]> => {
  const stored: StoredFile[] = [];
  try {
    for (const file of files) {
      const type = await detectType(file);
      if (!type || !allowed.has(type.mime))
        throw new HttpError(415, `Unsupported file type: ${file.originalname}`);
      const key = `${folder}/${randomUUID()}${type.ext}`;
      await moveIntoStorage(file.path, key);
      stored.push({
        key,
        mime: type.mime,
        ext: type.ext,
        size: file.size,
        name: decodeName(file.originalname).slice(0, 255),
      });
    }
    return stored;
  } catch (error) {
    await removeStored(stored.map((file) => file.key));
    await discardTemp(files);
    throw error;
  }
};
