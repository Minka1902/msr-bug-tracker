import { Router } from 'express';
import { z } from 'zod';
import { taskFilterSchema } from '@msr/shared/schemas/task';
import { badRequest } from '../../lib/httpError';
import { discardTemp, uploadFiles } from '../../lib/upload';
import { logger } from '../../lib/logger';
import { assertCanWrite, projectOf } from '../projects/access';
import { timezoneOf } from '../projects/routes';
import { IMPORT_FIELDS, detectMapping, rowToTask, type ColumnMapping } from './columns';
import { commitImport, previewImport } from './commit';
import { EXPORT_COLUMNS, exportBatches } from './export';
import { buildTemplate, readSheet, streamSheet, type SheetFormat } from './spreadsheet';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME: Record<SheetFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const formatSchema = z.object({ format: z.enum(['csv', 'xlsx']).default('xlsx') });
const importBodySchema = z.object({
  mode: z.enum(['preview', 'commit']).default('preview'),
  mapping: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'The column mapping is not valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(z.record(z.string(), z.enum(IMPORT_FIELDS).nullable()).optional()),
});

const formatOfFile = (name: string): SheetFormat => {
  const extension = name.toLowerCase().split('.').pop();
  if (extension === 'csv' || extension === 'xlsx') return extension;
  throw badRequest('Upload a .csv or .xlsx file');
};

const attachment = (format: SheetFormat, name: string) => ({
  'Content-Type': MIME[format],
  'Content-Disposition': `attachment; filename="${name}.${format}"`,
  'Cache-Control': 'no-store',
});

export const createImportTemplateRouter = () => {
  const router = Router();

  router.get('/template', async (req, res) => {
    const { format } = formatSchema.parse(req.query);
    res.set(attachment(format, 'msr-import-template')).send(await buildTemplate(format));
  });

  return router;
};

export const createProjectImportRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/tasks/export', async (req, res) => {
    const project = projectOf(req);
    const { format } = formatSchema.parse(req.query);
    const filters = taskFilterSchema.parse(req.query);
    res.set(
      attachment(format, `${project.key.toLowerCase()}-tasks-${new Date().toISOString().slice(0, 10)}`),
    );
    try {
      await streamSheet(
        res,
        format,
        EXPORT_COLUMNS,
        exportBatches(project.id, filters, { userId: req.user!.id, timezone: timezoneOf(req) }),
      );
    } catch (err) {
      logger.error({ err }, 'Task export failed');
      res.destroy(err as Error);
    }
  });

  router.post('/tasks/import', uploadFiles('file', MAX_FILE_BYTES, 1), async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      const project = projectOf(req);
      assertCanWrite(project, 'task.create');
      const [file] = files;
      if (!file) throw badRequest('Choose a file to import');
      const { mode, mapping: override } = importBodySchema.parse(req.body);
      const sheet = await readSheet(file.path, formatOfFile(file.originalname));
      const mapping: ColumnMapping = { ...detectMapping(sheet.headers), ...override };
      const hasTitle = Object.values(mapping).includes('title');
      if (mode === 'commit' && !hasTitle) throw badRequest('Pick which column holds the task title');
      const tasks = hasTitle ? sheet.rows.map((row) => rowToTask(row.values, mapping)) : [];
      const options = { rowNumbers: sheet.rows.map((row) => row.row) };
      if (mode === 'commit') {
        res.status(201).json(await commitImport(project, tasks, req.user!.id, options));
        return;
      }
      res.json({
        headers: sheet.headers,
        mapping,
        missingTitle: !hasTitle,
        ...(await previewImport(project, tasks, req.user!.id, options)),
        total: sheet.rows.length,
      });
    } finally {
      await discardTemp(files);
    }
  });

  return router;
};
