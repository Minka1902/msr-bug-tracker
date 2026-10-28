import { generateNKeysBetween } from 'fractional-indexing';
import type { CreateItemInput, UpdateItemInput } from '@msr/shared/schemas/shopping';
import type { ShoppingItem, ShoppingList } from '@msr/shared/types';
import { query, queryOne } from '../../db/pool';
import { positionAfter } from '../../lib/position';
import { avatarUrl } from '../users/service';

interface ListRow {
  id: string;
  name: string;
  position: string;
  items: {
    id: string;
    name: string;
    quantity: string;
    is_checked: boolean;
    checked_by: string | null;
    checked_by_name: string | null;
    checked_by_avatar: string | null;
    added_by: string | null;
    position: string;
  }[];
}

const LIST_LISTS = `
  SELECT l.id, l.name, l.position,
         coalesce((SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', i.quantity, 'is_checked', i.is_checked,
                                                     'checked_by', i.checked_by, 'checked_by_name', u.name,
                                                     'checked_by_avatar', u.avatar_key, 'added_by', i.added_by, 'position', i.position)
                             ORDER BY i.is_checked, i.position)
                   FROM shopping_items i LEFT JOIN users u ON u.id = i.checked_by WHERE i.list_id = l.id), '[]') AS items
  FROM shopping_lists l
  WHERE l.project_id = $1 AND ($2::uuid IS NULL OR l.id = $2)
  ORDER BY l.position, l.created_at`;
const LAST_LIST = 'SELECT max(position) AS position FROM shopping_lists WHERE project_id = $1';
const INSERT_LIST =
  'INSERT INTO shopping_lists (project_id, name, position) VALUES ($1, $2, $3) RETURNING id';
const UPDATE_LIST = `
  UPDATE shopping_lists SET name = coalesce($3, name), position = coalesce($4, position)
  WHERE id = $1 AND project_id = $2 RETURNING id`;
const DELETE_LIST = 'DELETE FROM shopping_lists WHERE id = $1 AND project_id = $2 RETURNING id';
const LIST_IN_PROJECT = 'SELECT id FROM shopping_lists WHERE id = $1 AND project_id = $2';
const FIRST_ITEM =
  'SELECT min(position) AS position FROM shopping_items WHERE list_id = $1 AND NOT is_checked';
const TELEGRAM_LISTENS = `
  EXISTS (SELECT 1 FROM telegram_chats c WHERE c.project_id = l.project_id AND 'shopping_changes' = ANY(c.notify))`;
const INSERT_ITEMS = `
  WITH added AS (
    INSERT INTO shopping_items (list_id, name, quantity, added_by, position)
    SELECT $1, name, quantity, $2, position FROM unnest($3::text[], $4::text[], $5::text[]) AS i(name, quantity, position)
  )
  INSERT INTO telegram_outbox (project_id, kind, payload, actor_id, source_chat_id)
  SELECT l.project_id, 'shopping_changes', jsonb_build_object('list', l.name, 'added', to_jsonb($3::text[])), $2, $6
  FROM shopping_lists l WHERE l.id = $1 AND ${TELEGRAM_LISTENS}`;
const UPDATE_ITEM = `
  UPDATE shopping_items i
  SET name = coalesce($3, i.name), quantity = coalesce($4, i.quantity), position = coalesce($6, i.position),
      is_checked = coalesce($5, i.is_checked),
      checked_by = CASE WHEN $5 IS NULL THEN i.checked_by WHEN $5 THEN $7 END,
      checked_at = CASE WHEN $5 IS NULL THEN i.checked_at WHEN $5 THEN now() END
  FROM shopping_lists l
  WHERE i.id = $1 AND l.id = i.list_id AND l.id = $2 AND l.project_id = $8
  RETURNING i.id`;
const DELETE_ITEM = `
  DELETE FROM shopping_items i USING shopping_lists l
  WHERE i.id = $1 AND l.id = i.list_id AND l.id = $2 AND l.project_id = $3 RETURNING i.id`;
const CHECK_ITEMS = `
  UPDATE shopping_items i
  SET is_checked = $3, checked_by = CASE WHEN $3 THEN $4::uuid END, checked_at = CASE WHEN $3 THEN now() END
  FROM shopping_lists l
  WHERE i.id = ANY($1::uuid[]) AND l.id = i.list_id AND l.project_id = $2
  RETURNING i.id`;
const CLEAR_CHECKED = `
  WITH cleared AS (
    DELETE FROM shopping_items i USING shopping_lists l
    WHERE i.list_id = $1 AND l.id = i.list_id AND l.project_id = $2 AND i.is_checked
    RETURNING i.name
  )
  INSERT INTO telegram_outbox (project_id, kind, payload, actor_id)
  SELECT l.project_id, 'shopping_changes',
         jsonb_build_object('list', l.name, 'cleared', (SELECT jsonb_agg(name) FROM cleared)), $3
  FROM shopping_lists l
  WHERE l.id = $1 AND EXISTS (SELECT 1 FROM cleared) AND ${TELEGRAM_LISTENS}`;

const toList = (row: ListRow): ShoppingList => ({
  id: row.id,
  name: row.name,
  position: row.position,
  items: row.items.map((item): ShoppingItem => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    isChecked: item.is_checked,
    checkedBy: item.checked_by
      ? {
          id: item.checked_by,
          name: item.checked_by_name!,
          avatarUrl: avatarUrl(item.checked_by, item.checked_by_avatar),
        }
      : null,
    addedBy: item.added_by,
    position: item.position,
  })),
});

export const listLists = (projectId: string) =>
  query<ListRow>(LIST_LISTS, [projectId, null]).then((rows) => rows.map(toList));

export const getList = (projectId: string, listId: string) =>
  queryOne<ListRow>(LIST_LISTS, [projectId, listId]).then((row) => (row ? toList(row) : null));

export const createList = async (projectId: string, name: string) => {
  const last = await queryOne<{ position: string | null }>(LAST_LIST, [projectId]);
  return (await queryOne<{ id: string }>(INSERT_LIST, [
    projectId,
    name,
    positionAfter(last?.position ?? null),
  ]))!.id;
};

export const updateList = (projectId: string, listId: string, input: { name?: string; position?: string }) =>
  queryOne<{ id: string }>(UPDATE_LIST, [listId, projectId, input.name ?? null, input.position ?? null]);

export const deleteList = (projectId: string, listId: string) =>
  queryOne<{ id: string }>(DELETE_LIST, [listId, projectId]);

export const listExists = (projectId: string, listId: string) =>
  queryOne<{ id: string }>(LIST_IN_PROJECT, [listId, projectId]).then(Boolean);

export const addItems = async (
  listId: string,
  items: CreateItemInput[],
  userId: string,
  sourceChatId: number | null = null,
) => {
  const first = await queryOne<{ position: string | null }>(FIRST_ITEM, [listId]);
  await query(INSERT_ITEMS, [
    listId,
    userId,
    items.map((item) => item.name),
    items.map((item) => item.quantity),
    generateNKeysBetween(null, first?.position ?? null, items.length),
    sourceChatId,
  ]);
};

export const updateItem = (
  projectId: string,
  listId: string,
  itemId: string,
  input: UpdateItemInput,
  userId: string,
) =>
  queryOne<{ id: string }>(UPDATE_ITEM, [
    itemId,
    listId,
    input.name ?? null,
    input.quantity ?? null,
    input.isChecked ?? null,
    input.position ?? null,
    userId,
    projectId,
  ]);

export const checkItems = (projectId: string, itemIds: string[], isChecked: boolean, userId: string) =>
  query<{ id: string }>(CHECK_ITEMS, [itemIds, projectId, isChecked, userId]);

export const deleteItem = (projectId: string, listId: string, itemId: string) =>
  queryOne<{ id: string }>(DELETE_ITEM, [itemId, listId, projectId]);

export const clearChecked = (projectId: string, listId: string, userId: string) =>
  query(CLEAR_CHECKED, [listId, projectId, userId]);
