import { Router } from 'express';
import { z } from 'zod';
import { hasConclusions } from '@msr/shared/modules';
import { uuidSchema } from '@msr/shared/schemas/project';
import { taskFilterSchema } from '@msr/shared/schemas/task';
import { notFound } from '../../lib/httpError';
import { projectOf } from '../projects/access';
import { timezoneOf } from '../projects/routes';
import { listTasks } from '../tasks/service';
import {
  getConclusions,
  getDashboard,
  getProjectActivity,
  getProjectOverview,
  MY_TASKS_SCOPE,
} from './service';

const activityQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const conclusionsQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    before: z.iso.datetime({ offset: true }).optional(),
    beforeId: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .refine((query) => !query.before === !query.beforeId, 'Pass before and beforeId together');

export const createInsightsRouter = () => {
  const router = Router();

  router.get('/dashboard', async (req, res) => {
    res.json(await getDashboard(req.user!.id, timezoneOf(req)));
  });

  router.get('/me/tasks', async (req, res) => {
    const filters = taskFilterSchema.parse(req.query);
    res.json(
      await listTasks(MY_TASKS_SCOPE, [req.user!.id], filters, {
        userId: req.user!.id,
        timezone: timezoneOf(req),
      }),
    );
  });

  return router;
};

export const createProjectInsightsRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/overview', async (req, res) => {
    res.json(await getProjectOverview(projectOf(req).id, req.user!.id, timezoneOf(req)));
  });

  router.get('/activity', async (req, res) => {
    const { before, limit } = activityQuerySchema.parse(req.query);
    res.json(await getProjectActivity(projectOf(req).id, req.user!.id, before ?? null, limit));
  });

  router.get('/conclusions', async (req, res) => {
    const project = projectOf(req);
    if (!hasConclusions(project.module)) throw notFound('This project has no conclusions');
    const { q, before, beforeId, limit } = conclusionsQuerySchema.parse(req.query);
    res.json(
      await getConclusions(
        project.id,
        req.user!.id,
        q || undefined,
        before && beforeId ? { completedAt: before, id: beforeId } : undefined,
        limit,
      ),
    );
  });

  return router;
};
