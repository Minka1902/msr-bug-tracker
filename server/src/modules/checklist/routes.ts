import { Router } from 'express';
import { createChecklistItemSchema, updateChecklistItemSchema } from '@msr/shared/schemas/collab';
import { notFound } from '../../lib/httpError';
import { assertCanEditTask, loadTaskAccess } from '../tasks/access';
import { createItem, deleteItem, getItemRow, listItems, updateItem } from './service';

export const createChecklistRouter = () => {
  const router = Router();

  const editableItem = async (itemId: string, userId: string) => {
    const item = await getItemRow(itemId);
    const access = item && (await loadTaskAccess(item.task_id, userId));
    if (!item || !access) throw notFound('Checklist item not found');
    assertCanEditTask(access.project, access.task, userId);
    return item;
  };

  router.get('/tasks/:taskId/checklist', async (req, res) => {
    if (!(await loadTaskAccess(req.params.taskId, req.user!.id))) throw notFound('Task not found');
    res.json({ items: await listItems(req.params.taskId) });
  });

  router.post('/tasks/:taskId/checklist', async (req, res) => {
    const access = await loadTaskAccess(req.params.taskId, req.user!.id);
    if (!access) throw notFound('Task not found');
    assertCanEditTask(access.project, access.task, req.user!.id);
    res
      .status(201)
      .json({ item: await createItem(access.task.id, createChecklistItemSchema.parse(req.body).text) });
  });

  router.patch('/checklist/:id', async (req, res) => {
    const item = await editableItem(req.params.id, req.user!.id);
    res.json({ item: await updateItem(item, updateChecklistItemSchema.parse(req.body)) });
  });

  router.delete('/checklist/:id', async (req, res) => {
    await deleteItem(await editableItem(req.params.id, req.user!.id));
    res.status(204).end();
  });

  return router;
};
