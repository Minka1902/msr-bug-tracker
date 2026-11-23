import { Router } from 'express';
import {
  commitPlanSchema,
  handoffPlanSchema,
  ideaSchema,
  planRequestSchema,
} from '@msr/shared/schemas/planner';
import type { RateLimits } from '../../middleware/rateLimits';
import { assertCanWrite, projectOf } from '../projects/access';
import { askQuestions, commitPlan, draftPlan, handoffPlan } from './service';

export const createPlannerRouter = (limits: RateLimits) => {
  const router = Router();

  router.post('/questions', limits.planner, async (req, res) => {
    res.json({ questions: await askQuestions(req.user!, ideaSchema.parse(req.body)) });
  });

  router.post('/plan', limits.planner, async (req, res) => {
    res.json(await draftPlan(req.user!, planRequestSchema.parse(req.body)));
  });

  return router;
};

export const createProjectPlanRouter = () => {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.create');
    const { agentId, ...draft } = commitPlanSchema.parse(req.body);
    res.status(201).json(await commitPlan(project, req.user!, draft, agentId));
  });

  router.post('/handoff', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.create');
    const { agentId, answers } = handoffPlanSchema.parse(req.body);
    res.status(201).json({ task: await handoffPlan(project, req.user!, agentId, answers) });
  });

  return router;
};
