import { Router } from 'express';
import { parseIdentifier } from '@msr/shared/identifiers';
import { canTransitionTask, missingTaskPermissions } from '@msr/shared/permissions';
import { moveTaskSchema, updateTaskSchema } from '@msr/shared/schemas/task';
import { prepared } from '../../db/pool';
import { forbidden, notFound } from '../../lib/httpError';
import { removeStored } from '../../lib/storage';
import { assertCanWrite, assertWritable, projectOf, toProjectContext } from '../projects/access';
import { listTaskActivity } from './activity';
import { loadTask, loadTaskAccess } from './access';
import {
  deleteTasks,
  duplicateTask,
  getTaskDetail,
  listSubtasks,
  moveTask,
  reopenTask,
  resolveIdentifier,
  updateTask,
} from './service';

const LOAD_TARGET_PROJECT = `
  SELECT p.id, p.key::text, p.owner_id, p.archived_at, r.permissions, r.id AS role_id, r.name AS role_name
  FROM projects p
  JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
  JOIN project_roles r ON r.id = m.role_id
  WHERE p.key = $1`;

export const createTasksRouter = () => {
  const router = Router();
  const scoped = Router({ mergeParams: true });

  router.get('/by-identifier/:identifier', async (req, res) => {
    const parsed = parseIdentifier(req.params.identifier);
    const taskId = parsed && (await resolveIdentifier(parsed.key, parsed.number));
    const access = taskId && (await loadTaskAccess(taskId, req.user!.id));
    if (!access) throw notFound('Task not found');
    res.json({ task: await getTaskDetail(access.task.id) });
  });

  scoped.get('/', async (req, res) => {
    res.json({ task: await getTaskDetail(req.task!.id) });
  });

  scoped.patch('/', async (req, res) => {
    const project = projectOf(req);
    assertWritable(project);
    const patch = updateTaskSchema.parse(req.body);
    const missing = missingTaskPermissions(project.permissions, req.task!, patch, req.user!.id);
    if (missing.length) throw forbidden(`Your role (${project.roleName}) can't do that`, { missing });
    res.json({ task: await updateTask(project, req.task!.id, patch, req.user!.id) });
  });

  scoped.delete('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.delete');
    await removeStored(await deleteTasks(project, [req.task!.id], req.user!.id));
    res.status(204).end();
  });

  scoped.post('/duplicate', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.create');
    res.status(201).json({ task: await duplicateTask(project, req.task!.id, req.user!.id) });
  });

  scoped.post('/reopen', async (req, res) => {
    const project = projectOf(req);
    assertWritable(project);
    if (!canTransitionTask(project.permissions, req.task!, req.user!.id))
      throw forbidden(`Your role (${project.roleName}) can't do that`, { missing: ['task.transition'] });
    res.json({ task: await reopenTask(project, req.task!.id, req.user!.id) });
  });

  scoped.post('/move', async (req, res) => {
    const source = projectOf(req);
    const { projectKey } = moveTaskSchema.parse(req.body);
    const [row] = await prepared<Parameters<typeof toProjectContext>[0]>(
      'load-target-project',
      LOAD_TARGET_PROJECT,
      [projectKey, req.user!.id],
    );
    if (!row) throw notFound('Target project not found');
    const target = toProjectContext(row, req.user!.id);
    assertCanWrite(source, 'task.move');
    assertCanWrite(target, 'task.create');
    if (target.id === source.id) throw notFound('The task is already in this project');
    res.json({ task: await moveTask(source, target, req.task!.id, req.user!.id) });
  });

  scoped.get('/activity', async (req, res) => {
    res.json({ activity: await listTaskActivity(req.task!.id) });
  });

  scoped.get('/subtasks', async (req, res) => {
    res.json({ tasks: await listSubtasks(req.task!.id) });
  });

  router.use('/:taskId', loadTask, scoped);
  return router;
};
