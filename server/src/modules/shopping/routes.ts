import { Router, type Request } from 'express';
import {
  createItemSchema,
  createListSchema,
  updateItemSchema,
  updateListSchema,
} from '@msr/shared/schemas/shopping';
import { notFound } from '../../lib/httpError';
import { assertValidPosition } from '../../lib/position';
import { assertCanWrite, projectOf } from '../projects/access';
import {
  addItem,
  clearChecked,
  createList,
  deleteItem,
  deleteList,
  getList,
  listExists,
  listLists,
  updateItem,
  updateList,
} from './service';

const LIST_NOT_FOUND = 'List not found';

const editableList = async (req: Request) => {
  const project = projectOf(req);
  assertCanWrite(project, 'lists.edit');
  const listId = String(req.params.listId);
  if (!(await listExists(project.id, listId))) throw notFound(LIST_NOT_FOUND);
  return { project, listId };
};

export const createShoppingRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    res.json({ lists: await listLists(projectOf(req).id) });
  });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'lists.edit');
    const id = await createList(project.id, createListSchema.parse(req.body).name);
    res.status(201).json({ list: await getList(project.id, id) });
  });

  router.patch('/:listId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'lists.edit');
    const input = updateListSchema.parse(req.body);
    if (input.position) assertValidPosition(input.position);
    if (!(await updateList(project.id, String(req.params.listId), input))) throw notFound(LIST_NOT_FOUND);
    res.json({ list: await getList(project.id, String(req.params.listId)) });
  });

  router.delete('/:listId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'lists.edit');
    if (!(await deleteList(project.id, String(req.params.listId)))) throw notFound(LIST_NOT_FOUND);
    res.status(204).end();
  });

  router.post('/:listId/items', async (req, res) => {
    const { project, listId } = await editableList(req);
    await addItem(listId, createItemSchema.parse(req.body), req.user!.id);
    res.status(201).json({ list: await getList(project.id, listId) });
  });

  router.patch('/:listId/items/:itemId', async (req, res) => {
    const { project, listId } = await editableList(req);
    const input = updateItemSchema.parse(req.body);
    if (input.position) assertValidPosition(input.position);
    if (!(await updateItem(project.id, listId, String(req.params.itemId), input, req.user!.id)))
      throw notFound('Item not found');
    res.json({ list: await getList(project.id, listId) });
  });

  router.delete('/:listId/items/:itemId', async (req, res) => {
    const { project, listId } = await editableList(req);
    if (!(await deleteItem(project.id, listId, String(req.params.itemId)))) throw notFound('Item not found');
    res.json({ list: await getList(project.id, listId) });
  });

  router.post('/:listId/clear-checked', async (req, res) => {
    const { project, listId } = await editableList(req);
    await clearChecked(project.id, listId);
    res.json({ list: await getList(project.id, listId) });
  });

  return router;
};
