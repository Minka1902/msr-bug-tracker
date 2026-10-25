import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  createProjectSchema,
  favoriteSchema,
  projectKeySchema,
  updateProjectSchema,
} from '@msr/shared/schemas/project';
import { conflict } from '../../lib/httpError';
import { removeStored } from '../../lib/storage';
import { createLabelsRouter } from '../labels/routes';
import { createProjectInvitesRouter } from '../invites/routes';
import { createMembersRouter } from '../members/routes';
import { createRolesRouter } from '../roles/routes';
import { createStatusesRouter } from '../statuses/routes';
import { createProjectTasksRouter } from '../tasks/projectRoutes';
import { createProjectInsightsRouter } from '../insights/routes';
import { DEFAULT_PREFERENCES } from '../users/service';
import { assertCan, assertCanWrite, assertOwner, loadProject, projectOf } from './access';
import {
  createProject,
  deleteProject,
  getProjectDetail,
  getProjectSummary,
  keyAvailability,
  listProjects,
  setArchived,
  setFavorite,
  updateProject,
} from './service';

const listQuerySchema = z.object({ archived: z.enum(['true', 'false', 'all']).default('false') });
const ARCHIVED_FILTER = { true: 'archived', false: 'active', all: 'all' } as const;

export const timezoneOf = (req: Request) => req.user!.preferences.timezone ?? DEFAULT_PREFERENCES.timezone;

export const createProjectsRouter = () => {
  const router = Router();
  const scoped = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const { archived } = listQuerySchema.parse(req.query);
    res.json({ projects: await listProjects(req.user!.id, timezoneOf(req), ARCHIVED_FILTER[archived]) });
  });

  router.post('/', async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    if (!(await keyAvailability(input.key)).available)
      throw conflict(`The key ${input.key} is already taken`);
    const projectId = await createProject(input, req.user!.id);
    res.status(201).json({ project: await getProjectDetail(projectId, req.user!.id, timezoneOf(req)) });
  });

  router.get('/key-available', async (req, res) => {
    res.json(await keyAvailability(projectKeySchema.parse(req.query.key)));
  });

  scoped.get('/', async (req, res) => {
    res.json({ project: await getProjectDetail(projectOf(req).id, req.user!.id, timezoneOf(req)) });
  });

  scoped.patch('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.edit');
    await updateProject(project.id, updateProjectSchema.parse(req.body));
    res.json({ project: await getProjectSummary(project.id, req.user!.id, timezoneOf(req)) });
  });

  scoped.post('/archive', async (req, res) => {
    const project = projectOf(req);
    assertCan(project, 'project.archive');
    await setArchived(project.id, true);
    res.json({ project: await getProjectSummary(project.id, req.user!.id, timezoneOf(req)) });
  });

  scoped.post('/restore', async (req, res) => {
    const project = projectOf(req);
    assertCan(project, 'project.archive');
    await setArchived(project.id, false);
    res.json({ project: await getProjectSummary(project.id, req.user!.id, timezoneOf(req)) });
  });

  scoped.delete('/', async (req, res) => {
    const project = projectOf(req);
    assertOwner(project);
    await removeStored(await deleteProject(project.id));
    res.status(204).end();
  });

  scoped.put('/favorite', async (req, res) => {
    await setFavorite(projectOf(req).id, req.user!.id, favoriteSchema.parse(req.body).favorite);
    res.status(204).end();
  });

  scoped.use('/statuses', createStatusesRouter());
  scoped.use('/labels', createLabelsRouter());
  scoped.use('/roles', createRolesRouter());
  scoped.use('/members', createMembersRouter());
  scoped.use('/invites', createProjectInvitesRouter());
  scoped.use(createProjectTasksRouter());
  scoped.use(createProjectInsightsRouter());

  router.use('/:key', loadProject, scoped);
  return router;
};
