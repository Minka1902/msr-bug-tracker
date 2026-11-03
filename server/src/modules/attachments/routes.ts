import { Router, type Request } from 'express';
import { config } from '../../config';
import { HttpError, badRequest, forbidden, notFound } from '../../lib/httpError';
import { sendStored } from '../../lib/storage';
import { ATTACHMENT_TYPES, storeUploads, uploadFiles } from '../../lib/upload';
import { assertCanWrite, assertWritable } from '../projects/access';
import { loadTaskAccess } from '../tasks/access';
import { ATTACHMENT_RETENTION_DAYS } from '@msr/shared/attachments';
import { can } from '@msr/shared/permissions';
import { deleteAttachment, getAttachment, listAttachments, saveAttachments } from './service';

const INLINE_TYPES = /^(image\/|video\/|application\/pdf$)/;
const MAX_FILES = 10;
const PURGED_MESSAGE = `Deleted ${ATTACHMENT_RETENTION_DAYS} days after the card was done`;
const PURGED_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120" role="img" aria-label="Image deleted"><rect width="480" height="120" rx="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-dasharray="6 6"/><text x="240" y="54" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#475569">Image deleted</text><text x="240" y="80" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#64748b">${PURGED_MESSAGE}</text></svg>`;

const receive = async (req: Request) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('Choose at least one file');
  return storeUploads(files, ATTACHMENT_TYPES, `attachments/${new Date().toISOString().slice(0, 7)}`);
};

export const createAttachmentsRouter = () => {
  const router = Router();
  const upload = uploadFiles('files', config.maxUploadBytes, MAX_FILES);

  router.post('/attachments', upload, async (req, res) => {
    res.status(201).json({ attachments: await saveAttachments(await receive(req), req.user!.id, null) });
  });

  router.post('/tasks/:taskId/attachments', async (req, res, next) => {
    const access = await loadTaskAccess(req.params.taskId, req.user!.id);
    if (!access) throw notFound('Task not found');
    assertCanWrite(access.project, 'attachment.upload');
    req.task = access.task;
    upload(req, res, next);
  });
  router.post('/tasks/:taskId/attachments', async (req, res) => {
    res
      .status(201)
      .json({ attachments: await saveAttachments(await receive(req), req.user!.id, req.task!.id) });
  });

  router.get('/tasks/:taskId/attachments', async (req, res) => {
    if (!(await loadTaskAccess(req.params.taskId, req.user!.id))) throw notFound('Task not found');
    res.json({ attachments: await listAttachments(req.params.taskId) });
  });

  router.get('/attachments/:id', async (req, res) => {
    const file = await getAttachment(req.params.id).catch(() => undefined);
    const allowed =
      file &&
      (file.task_id ? await loadTaskAccess(file.task_id, req.user!.id) : file.uploader_id === req.user!.id);
    if (!file || !allowed) throw notFound('File not found');
    if (file.purged_at) {
      if (!file.mime.startsWith('image/')) throw new HttpError(410, PURGED_MESSAGE);
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.type('svg').send(PURGED_IMAGE);
      return;
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
    );
    res.setHeader(
      'Content-Disposition',
      `${INLINE_TYPES.test(file.mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    await sendStored(req, res, file.storage_key);
  });

  router.delete('/attachments/:id', async (req, res) => {
    const file = await getAttachment(req.params.id).catch(() => undefined);
    if (!file) throw notFound('File not found');
    if (file.task_id) {
      const access = await loadTaskAccess(file.task_id, req.user!.id);
      if (!access) throw notFound('File not found');
      assertWritable(access.project);
      if (file.uploader_id !== req.user!.id && !can(access.project.permissions, 'attachment.delete_any'))
        throw forbidden(`Your role (${access.project.roleName}) can't delete others' files`, {
          missing: ['attachment.delete_any'],
        });
    } else if (file.uploader_id !== req.user!.id) throw notFound('File not found');
    await deleteAttachment(file.id, req.user!.id);
    res.status(204).end();
  });

  return router;
};
