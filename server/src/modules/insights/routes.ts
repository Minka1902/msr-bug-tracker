import { Router } from 'express';
import { z } from 'zod';
import { taskFilterSchema } from '@msr/shared/schemas/task';
import { projectOf } from '../projects/access';
import { timezoneOf } from '../projects/routes';
import { listTasks } from '../tasks/service';
import { getDashboard, getProjectActivity, getProjectOverview } from './service';

const activityQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const MY_TASKS_SCOPE = `t.assignee_id = $1 AND p.archived_at IS NULL
  AND t.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;

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
    res.json(await getProjectActivity(projectOf(req).id, before ?? null, limit));
  });

  return router;
};
