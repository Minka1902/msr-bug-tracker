import { Router } from 'express';
import { commitPlanSchema, ideaSchema, planRequestSchema } from '@msr/shared/schemas/planner';
import type { RateLimits } from '../../middleware/rateLimits';
import { assertCanWrite, projectOf } from '../projects/access';
import { askQuestions, commitPlan, draftPlan } from './service';

export const createPlannerRouter = (limits: RateLimits) => {
  const router = Router();

  router.post('/questions', limits.planner, async (req, res) => {
    res.json({ questions: await askQuestions(req.user!, ideaSchema.parse(req.body)) });
  });

  router.post('/plan', limits.planner, async (req, res) => {
    res.json({ tasks: await draftPlan(req.user!, planRequestSchema.parse(req.body)) });
  });

  return router;
};

export const createProjectPlanRouter = () => {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.create');
    const { tasks, agentId } = commitPlanSchema.parse(req.body);
    res.status(201).json(await commitPlan(project, req.user!, tasks, agentId));
  });

  return router;
};
