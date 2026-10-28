import { randomBytes } from 'node:crypto';
import type { ProjectModule } from '@msr/shared/modules';
import type { NotifyKind } from '@msr/shared/telegram';
import { query, queryOne, transaction } from '../../db/pool';
import { hashToken } from '../../lib/tokens';
import { USER_COLUMNS, type UserRow } from '../users/service';

export interface ChatRow {
  chat_id: number;
  project_id: string;
  title: string;
  is_group: boolean;
  linked_by: string | null;
  notify: NotifyKind[];
  only_mine: boolean;
  default_list_id: string | null;
  key: string;
  name: string;
  module: ProjectModule;
  owner_id: string;
}

const CODE_TTL_MINUTES = 15;

const INSERT_CODE = `
  WITH purge AS (DELETE FROM telegram_link_codes WHERE expires_at < now())
  INSERT INTO telegram_link_codes (code_hash, user_id, project_id, is_group, expires_at)
  VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`;
const CONSUME_CODE = `
  DELETE FROM telegram_link_codes c WHERE code_hash = $1 AND expires_at > now()
  RETURNING user_id, is_group, (SELECT key::text FROM projects p WHERE p.id = c.project_id) AS key`;
const RELEASE_TELEGRAM = 'UPDATE users SET telegram_user_id = NULL WHERE telegram_user_id = $1 AND id <> $2';
const LINK_USER = 'UPDATE users SET telegram_user_id = $1 WHERE id = $2';
const UNLINK_USER = `
  WITH private AS (DELETE FROM telegram_chats WHERE linked_by = $1 AND NOT is_group)
  UPDATE users SET telegram_user_id = NULL WHERE id = $1`;
const LINK_CHAT = `
  INSERT INTO telegram_chats (chat_id, project_id, title, is_group, linked_by)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (chat_id, project_id)
  DO UPDATE SET title = EXCLUDED.title, linked_by = EXCLUDED.linked_by, selected_at = now()`;
const CHAT_COLUMNS = `
  c.chat_id, c.project_id, c.title, c.is_group, c.linked_by, c.notify, c.only_mine, c.default_list_id,
  p.key::text AS key, p.name, p.module, p.owner_id`;
const CURRENT_CHAT = `
  SELECT ${CHAT_COLUMNS} FROM telegram_chats c JOIN projects p ON p.id = c.project_id
  WHERE c.chat_id = $1 ORDER BY c.selected_at DESC LIMIT 1`;
const SELECT_PROJECT = `
  UPDATE telegram_chats c SET selected_at = now() FROM projects p
  WHERE p.id = c.project_id AND c.chat_id = $1 AND p.key = $2 RETURNING c.project_id`;
const SENDER = `SELECT ${USER_COLUMNS} FROM users WHERE telegram_user_id = $1`;
const PROJECT_CHATS = `
  SELECT ${CHAT_COLUMNS} FROM telegram_chats c JOIN projects p ON p.id = c.project_id
  WHERE c.project_id = $1 ORDER BY c.is_group DESC, c.created_at`;
const UPDATE_CHAT = `
  UPDATE telegram_chats SET notify = coalesce($3, notify), only_mine = coalesce($4, only_mine),
         default_list_id = CASE WHEN $5 THEN $6 ELSE default_list_id END
  WHERE chat_id = $1 AND project_id = $2 RETURNING chat_id`;
const DELETE_CHAT = 'DELETE FROM telegram_chats WHERE chat_id = $1 AND project_id = $2 RETURNING chat_id';
const DROP_CHAT = 'DELETE FROM telegram_chats WHERE chat_id = $1';
const HAS_TELEGRAM = 'SELECT telegram_user_id IS NOT NULL AS linked FROM users WHERE id = $1';
const STATUS_NAME = 'SELECT name FROM project_statuses WHERE id = $1';
const OPEN_TASKS = `
  SELECT t.number, t.title, t.due_date::text AS due_date, u.name AS assignee
  FROM tasks t
  JOIN project_statuses s ON s.id = t.status_id
  LEFT JOIN users u ON u.id = t.assignee_id
  WHERE t.project_id = $1 AND s.category <> 'done' AND t.parent_id IS NULL AND ($2::uuid IS NULL OR t.assignee_id = $2)
  ORDER BY u.name NULLS LAST, t.due_date NULLS LAST, t.number
  LIMIT $3`;

export const createLinkCode = async (userId: string, projectId: string, isGroup: boolean) => {
  const code = randomBytes(16).toString('base64url');
  await query(INSERT_CODE, [hashToken(code), userId, projectId, isGroup, CODE_TTL_MINUTES]);
  return code;
};

export const consumeLinkCode = (code: string) =>
  queryOne<{ user_id: string; is_group: boolean; key: string }>(CONSUME_CODE, [hashToken(code)]);

export const linkUser = (telegramUserId: number, userId: string) =>
  transaction(async (db) => {
    await query(RELEASE_TELEGRAM, [telegramUserId, userId], db);
    await query(LINK_USER, [telegramUserId, userId], db);
  });

export const unlinkUser = (userId: string) => query(UNLINK_USER, [userId]);

export const linkChat = (
  chatId: number,
  projectId: string,
  title: string,
  isGroup: boolean,
  userId: string,
) => query(LINK_CHAT, [chatId, projectId, title, isGroup, userId]);

export const currentChat = (chatId: number) => queryOne<ChatRow>(CURRENT_CHAT, [chatId]);

export const selectProject = (chatId: number, key: string) =>
  queryOne<{ project_id: string }>(SELECT_PROJECT, [chatId, key]);

export const findSender = (telegramUserId: number) => queryOne<UserRow>(SENDER, [telegramUserId]);

export const projectChats = (projectId: string) => query<ChatRow>(PROJECT_CHATS, [projectId]);

export const updateChat = (
  chatId: number,
  projectId: string,
  patch: { notify?: NotifyKind[]; onlyMine?: boolean; defaultListId?: string | null },
) =>
  queryOne(UPDATE_CHAT, [
    chatId,
    projectId,
    patch.notify ?? null,
    patch.onlyMine ?? null,
    patch.defaultListId !== undefined,
    patch.defaultListId ?? null,
  ]);

export const deleteChat = (chatId: number, projectId: string) => queryOne(DELETE_CHAT, [chatId, projectId]);

export const dropChat = (chatId: number) => query(DROP_CHAT, [chatId]);

export const hasTelegram = (userId: string) =>
  queryOne<{ linked: boolean }>(HAS_TELEGRAM, [userId]).then((row) => !!row?.linked);

export const openTasks = (projectId: string, assigneeId: string | null, limit: number) =>
  query<{ number: number; title: string; due_date: string | null; assignee: string | null }>(OPEN_TASKS, [
    projectId,
    assigneeId,
    limit,
  ]);

export const statusName = (statusId: string) =>
  queryOne<{ name: string }>(STATUS_NAME, [statusId]).then((row) => row?.name ?? null);
