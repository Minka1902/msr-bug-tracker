import { Router } from 'express';
import {
  boardQuerySchema,
  bulkDeleteSchema,
  bulkUpdateSchema,
  createTaskSchema,
  taskFilterSchema,
} from '@msr/shared/schemas/task';
import { removeStored } from '../../lib/storage';
import { assertCanWrite, projectOf } from '../projects/access';
import { timezoneOf } from '../projects/routes';
import { assertCanAssignOnCreate } from './access';
import { bulkUpdateTasks, createTask, deleteTasks, getBoard, listTasks } from './service';

export const createProjectTasksRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/tasks', async (req, res) => {
    const filters = taskFilterSchema.parse(req.query);
    res.json(
      await listTasks('t.project_id = $1', [projectOf(req).id], filters, {
        userId: req.user!.id,
        timezone: timezoneOf(req),
      }),
    );
  });

  router.post('/tasks', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.create');
    const input = createTaskSchema.parse(req.body);
    assertCanAssignOnCreate(project, input.assigneeId, req.user!.id);
    res.status(201).json({ task: await createTask(project, input, req.user!.id) });
  });

  router.patch('/tasks/bulk', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project);
    const { ids, patch } = bulkUpdateSchema.parse(req.body);
    res.json({ tasks: await bulkUpdateTasks(project, ids, patch, req.user!.id) });
  });

  router.post('/tasks/bulk-delete', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'task.delete');
    const { ids } = bulkDeleteSchema.parse(req.body);
    await removeStored(await deleteTasks(project, ids, req.user!.id));
    res.status(204).end();
  });

  router.get('/board', async (req, res) => {
    const { workflow, ...filters } = boardQuerySchema.parse(req.query);
    res.json({
      columns: await getBoard(projectOf(req).id, workflow, filters, {
        userId: req.user!.id,
        timezone: timezoneOf(req),
      }),
    });
  });

  return router;
};
