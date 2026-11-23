import { Router } from 'express';
import { canTransitionTask } from '@msr/shared/permissions';
import { moveTaskSchema, updateTaskSchema } from '@msr/shared/schemas/task';
import { forbidden, notFound } from '../../lib/httpError';
import { removeUnreferenced } from '../attachments/service';
import { assertCanWrite, assertWritable, projectOf } from '../projects/access';
import { listTaskActivity } from './activity';
import {
  assertCanPatchTask,
  assertCardTypeEditable,
  findTaskByIdentifier,
  loadMoveTarget,
  loadTask,
} from './access';
import {
  deleteTasks,
  duplicateTask,
  getTaskDetail,
  listSubtasks,
  moveTask,
  reopenTask,
  updateTask,
} from './service';

export const createTasksRouter = () => {
  const router = Router();
  const scoped = Router({ mergeParams: true });

  router.get('/by-identifier/:identifier', async (req, res) => {
    const access = await findTaskByIdentifier(req.params.identifier, req.user!.id);
    res.json({ task: await getTaskDetail(access.task.id) });
  });

  scoped.get('/', async (req, res) => {
    res.json({ task: await getTaskDetail(req.task!.id) });
  });

  scoped.patch('/', async (req, res) => {
    const project = projectOf(req);
    const patch = updateTaskSchema.parse(req.body);
    assertCanPatchTask(project, req.task!, patch, req.user!.id);
    res.json({ task: await updateTask(project, req.task!.id, patch, req.user!.id) });
  });

  scoped.delete('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.delete');
    assertCardTypeEditable(project, req.task!);
    await removeUnreferenced(await deleteTasks(project, [req.task!.id], req.user!.id));
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
    assertCardTypeEditable(project, req.task!);
    if (!canTransitionTask(project.permissions, req.task!, req.user!.id))
      throw forbidden(`Your role (${project.roleName}) can't do that`, { missing: ['task.transition'] });
    res.json({ task: await reopenTask(project, req.task!.id, req.user!.id) });
  });

  scoped.post('/move', async (req, res) => {
    const source = projectOf(req);
    const { projectKey } = moveTaskSchema.parse(req.body);
    const target = await loadMoveTarget(source, projectKey, req.user!.id);
    assertCardTypeEditable(source, req.task!);
    if (target.id === source.id) throw notFound('The task is already in this project');
    res.json({ task: await moveTask(source, target, req.task!.id, req.user!.id) });
  });

  scoped.get('/activity', async (req, res) => {
    res.json({ activity: await listTaskActivity(req.task!.id) });
  });

  scoped.get('/subtasks', async (req, res) => {
    res.json({ tasks: await listSubtasks(req.task!.id, req.user!.id) });
  });

  router.use('/:taskId', loadTask, scoped);
  return router;
};
