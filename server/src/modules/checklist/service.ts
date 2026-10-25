import type { ChecklistItem } from '@msr/shared/types';
import { query, queryOne, transaction } from '../../db/pool';
import { assertValidPosition, positionAfter } from '../../lib/position';

interface ItemRow {
  id: string;
  task_id: string;
  text: string;
  is_done: boolean;
  position: string;
}

const LIST_ITEMS =
  'SELECT id, task_id, text, is_done, position FROM task_checklist_items WHERE task_id = $1 ORDER BY position, created_at';
const GET_ITEM = 'SELECT id, task_id, text, is_done, position FROM task_checklist_items WHERE id = $1';
const LAST_POSITION = 'SELECT max(position) AS position FROM task_checklist_items WHERE task_id = $1';
const INSERT_ITEM =
  'INSERT INTO task_checklist_items (task_id, text, position) VALUES ($1, $2, $3) RETURNING id, task_id, text, is_done, position';
const UPDATE_ITEM = `
  UPDATE task_checklist_items SET text = COALESCE($2, text), is_done = COALESCE($3, is_done), position = COALESCE($4, position)
  WHERE id = $1 RETURNING id, task_id, text, is_done, position`;
const DELETE_ITEM = 'DELETE FROM task_checklist_items WHERE id = $1';
const REFRESH_COUNTS = `
  UPDATE tasks SET checklist_total = c.total, checklist_done = c.done, updated_at = now()
  FROM (SELECT count(*)::int AS total, count(*) FILTER (WHERE is_done)::int AS done FROM task_checklist_items WHERE task_id = $1) c
  WHERE id = $1`;

const toItem = (row: ItemRow): ChecklistItem => ({
  id: row.id,
  text: row.text,
  isDone: row.is_done,
  position: row.position,
});

export const getItemRow = (id: string) => queryOne<ItemRow>(GET_ITEM, [id]).catch(() => undefined);

export const listItems = (taskId: string) =>
  query<ItemRow>(LIST_ITEMS, [taskId]).then((rows) => rows.map(toItem));

export const createItem = (taskId: string, text: string) =>
  transaction(async (db) => {
    await query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [taskId], db);
    const last = await queryOne<{ position: string | null }>(LAST_POSITION, [taskId], db);
    const item = await queryOne<ItemRow>(INSERT_ITEM, [taskId, text, positionAfter(last?.position)], db);
    await query(REFRESH_COUNTS, [taskId], db);
    return toItem(item!);
  });

export const updateItem = (item: ItemRow, input: { text?: string; isDone?: boolean; position?: string }) => {
  if (input.position) assertValidPosition(input.position);
  return transaction(async (db) => {
    const updated = await queryOne<ItemRow>(
      UPDATE_ITEM,
      [item.id, input.text ?? null, input.isDone ?? null, input.position ?? null],
      db,
    );
    if (input.isDone !== undefined) await query(REFRESH_COUNTS, [item.task_id], db);
    return toItem(updated!);
  });
};

export const deleteItem = (item: ItemRow) =>
  transaction(async (db) => {
    await query(DELETE_ITEM, [item.id], db);
    await query(REFRESH_COUNTS, [item.task_id], db);
  });
