import { Router } from 'express';
import { z } from 'zod';
import { createProjectSchema, projectKeySchema, uuidSchema } from '@msr/shared/schemas/project';
import { conflict, notFound } from '../../lib/httpError';
import type { RateLimits } from '../../middleware/rateLimits';
import { assertCanWrite, findProjectContext } from '../projects/access';
import { createProject, keyAvailability } from '../projects/service';
import { asana } from './adapters/asana';
import { clickup } from './adapters/clickup';
import { github } from './adapters/github';
import { jira } from './adapters/jira';
import { linear } from './adapters/linear';
import { trello } from './adapters/trello';
import { commitJob, discardJob, getJob, startJob, summarizeJob } from './jobs';
import type { MigrationAdapter } from './types';

const ADAPTERS: Record<string, MigrationAdapter<unknown>> = {
  clickup,
  jira,
  trello,
  asana,
  linear,
  github,
} as Record<string, MigrationAdapter<unknown>>;

const sourcesSchema = z.object({ credentials: z.record(z.string(), z.unknown()) });
const startSchema = sourcesSchema.extend({
  sourceId: z.string().trim().min(1).max(200),
  includeComments: z.boolean().default(true),
  includeClosed: z.boolean().default(true),
});
const commitSchema = z.object({
  target: z.union([z.object({ projectKey: projectKeySchema }), z.object({ project: createProjectSchema })]),
  statusMap: z.record(z.string().max(200), uuidSchema).default({}),
  memberMap: z.record(z.string().max(300), uuidSchema.nullable()).default({}),
});

const adapterOf = (tool: unknown) => {
  const adapter = typeof tool === 'string' ? ADAPTERS[tool] : undefined;
  if (!adapter) throw notFound('Unknown tool');
  return adapter;
};

export const createMigrationsRouter = (limits: RateLimits) => {
  const router = Router();

  router.post('/:tool/sources', limits.migrations, async (req, res) => {
    const adapter = adapterOf(req.params.tool);
    const credentials = adapter.credentials.parse(sourcesSchema.parse(req.body).credentials);
    res.json({ sources: await adapter.listSources(credentials) });
  });

  router.post('/:tool/jobs', limits.migrations, async (req, res) => {
    const adapter = adapterOf(req.params.tool);
    const input = startSchema.parse(req.body);
    const job = startJob(
      req.user!.id,
      adapter.label,
      adapter,
      adapter.credentials.parse(input.credentials),
      input.sourceId,
      {
        includeComments: input.includeComments,
        includeClosed: input.includeClosed,
      },
    );
    res.status(202).json({ job: summarizeJob(job) });
  });

  router.get('/jobs/:id', (req, res) => {
    res.json({ job: summarizeJob(getJob(req.params.id, req.user!.id)) });
  });

  router.post('/jobs/:id/commit', async (req, res) => {
    const job = getJob(req.params.id, req.user!.id);
    const input = commitSchema.parse(req.body);
    let key: string;
    if ('projectKey' in input.target) key = input.target.projectKey;
    else {
      if (!(await keyAvailability(input.target.project.key)).available)
        throw conflict(`The key ${input.target.project.key} is already taken`);
      await createProject(input.target.project, req.user!.id);
      key = input.target.project.key;
    }
    const project = await findProjectContext(key, req.user!.id);
    assertCanWrite(project, 'task.create');
    commitJob(job, project, { statusMap: input.statusMap, memberMap: input.memberMap });
    res.status(202).json({ job: summarizeJob(job) });
  });

  router.delete('/jobs/:id', (req, res) => {
    discardJob(getJob(req.params.id, req.user!.id));
    res.status(204).end();
  });

  return router;
};
