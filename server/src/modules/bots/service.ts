import { randomBytes } from 'node:crypto';
import type { BotPlatform, NotifyKind } from '@msr/shared/bots';
import type { ProjectModule } from '@msr/shared/modules';
import { query, queryOne, transaction } from '../../db/pool';
import { hashToken } from '../../lib/tokens';
import { visibleTo } from '../cardTypes/visibility';
import { USER_COLUMNS, type UserRow } from '../users/service';

export interface ChatRow {
  platform: BotPlatform;
  chat_id: string;
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

export interface ChatRef {
  platform: BotPlatform;
  chatId: string;
}

const CODE_TTL_MINUTES = 15;

const INSERT_CODE = `
  WITH purge AS (DELETE FROM bot_link_codes WHERE expires_at < now())
  INSERT INTO bot_link_codes (code_hash, platform, user_id, project_id, is_group, expires_at)
  VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))`;
const CONSUME_CODE = `
  DELETE FROM bot_link_codes c WHERE code_hash = $1 AND platform = $2 AND expires_at > now()
  RETURNING user_id, is_group, (SELECT key::text FROM projects p WHERE p.id = c.project_id) AS key`;
const RELEASE_ACCOUNT = 'DELETE FROM bot_accounts WHERE platform = $1 AND (external_id = $2 OR user_id = $3)';
const LINK_USER = 'INSERT INTO bot_accounts (platform, external_id, user_id) VALUES ($1, $2, $3)';
const UNLINK_USER = `
  WITH private AS (DELETE FROM bot_chats WHERE platform = $1 AND linked_by = $2 AND NOT is_group)
  DELETE FROM bot_accounts WHERE platform = $1 AND user_id = $2`;
const LINK_CHAT = `
  INSERT INTO bot_chats (platform, chat_id, project_id, title, is_group, linked_by)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (platform, chat_id, project_id)
  DO UPDATE SET title = EXCLUDED.title, linked_by = EXCLUDED.linked_by, selected_at = now()`;
const CHAT_COLUMNS = `
  c.platform, c.chat_id, c.project_id, c.title, c.is_group, c.linked_by, c.notify, c.only_mine, c.default_list_id,
  p.key::text AS key, p.name, p.module, p.owner_id`;
const CURRENT_CHAT = `
  SELECT ${CHAT_COLUMNS} FROM bot_chats c JOIN projects p ON p.id = c.project_id
  WHERE c.platform = $1 AND c.chat_id = $2 ORDER BY c.selected_at DESC LIMIT 1`;
const SELECT_PROJECT = `
  UPDATE bot_chats c SET selected_at = now() FROM projects p
  WHERE p.id = c.project_id AND c.platform = $1 AND c.chat_id = $2 AND p.key = $3 RETURNING c.project_id`;
const SENDER = `
  SELECT ${USER_COLUMNS} FROM users
  WHERE id = (SELECT user_id FROM bot_accounts WHERE platform = $1 AND external_id = $2)`;
const PROJECT_CHATS = `
  SELECT ${CHAT_COLUMNS} FROM bot_chats c JOIN projects p ON p.id = c.project_id
  WHERE c.project_id = $1 ORDER BY c.is_group DESC, c.created_at`;
const UPDATE_CHAT = `
  UPDATE bot_chats SET notify = coalesce($4, notify), only_mine = coalesce($5, only_mine),
         default_list_id = CASE WHEN $6 THEN $7 ELSE default_list_id END
  WHERE platform = $1 AND chat_id = $2 AND project_id = $3 RETURNING chat_id`;
const DELETE_CHAT =
  'DELETE FROM bot_chats WHERE platform = $1 AND chat_id = $2 AND project_id = $3 RETURNING chat_id';
const DROP_CHAT = 'DELETE FROM bot_chats WHERE platform = $1 AND chat_id = $2';
const MIGRATE_CHAT = 'UPDATE bot_chats SET chat_id = $3 WHERE platform = $1 AND chat_id = $2';
const QUEUE_NOTIFICATION = `
  INSERT INTO bot_outbox (project_id, kind, payload, actor_id)
  SELECT $1, $2, $3, $4
  WHERE EXISTS (SELECT 1 FROM bot_chats WHERE project_id = $1 AND $2::text = ANY(notify))`;
const LINKED_PLATFORMS = 'SELECT platform FROM bot_accounts WHERE user_id = $1';
const STATUS_NAME = 'SELECT name FROM project_statuses WHERE id = $1';
const OPEN_TASKS = `
  SELECT t.number, t.title, t.due_date::text AS due_date, u.name AS assignee
  FROM tasks t
  JOIN project_statuses s ON s.id = t.status_id
  LEFT JOIN users u ON u.id = t.assignee_id
  WHERE t.project_id = $1 AND s.category <> 'done' AND t.parent_id IS NULL AND ($2::uuid IS NULL OR t.assignee_id = $2)
    AND ${visibleTo('t', '$4::uuid')}
  ORDER BY u.name NULLS LAST, t.due_date NULLS LAST, t.number
  LIMIT $3`;

export const createLinkCode = async (
  platform: BotPlatform,
  userId: string,
  projectId: string,
  isGroup: boolean,
) => {
  const code = randomBytes(16).toString('base64url');
  await query(INSERT_CODE, [hashToken(code), platform, userId, projectId, isGroup, CODE_TTL_MINUTES]);
  return code;
};

export const consumeLinkCode = (platform: BotPlatform, code: string) =>
  queryOne<{ user_id: string; is_group: boolean; key: string }>(CONSUME_CODE, [hashToken(code), platform]);

export const linkUser = (platform: BotPlatform, externalId: string, userId: string) =>
  transaction(async (db) => {
    await query(RELEASE_ACCOUNT, [platform, externalId, userId], db);
    await query(LINK_USER, [platform, externalId, userId], db);
  });

export const unlinkUser = (platform: BotPlatform, userId: string) => query(UNLINK_USER, [platform, userId]);

export const linkChat = (chat: ChatRef, projectId: string, title: string, isGroup: boolean, userId: string) =>
  query(LINK_CHAT, [chat.platform, chat.chatId, projectId, title, isGroup, userId]);

export const currentChat = (chat: ChatRef) => queryOne<ChatRow>(CURRENT_CHAT, [chat.platform, chat.chatId]);

export const selectProject = (chat: ChatRef, key: string) =>
  queryOne<{ project_id: string }>(SELECT_PROJECT, [chat.platform, chat.chatId, key]);

export const findSender = (platform: BotPlatform, externalId: string) =>
  queryOne<UserRow>(SENDER, [platform, externalId]);

export const projectChats = (projectId: string) => query<ChatRow>(PROJECT_CHATS, [projectId]);

export const updateChat = (
  chat: ChatRef,
  projectId: string,
  patch: { notify?: NotifyKind[]; onlyMine?: boolean; defaultListId?: string | null },
) =>
  queryOne(UPDATE_CHAT, [
    chat.platform,
    chat.chatId,
    projectId,
    patch.notify ?? null,
    patch.onlyMine ?? null,
    patch.defaultListId !== undefined,
    patch.defaultListId ?? null,
  ]);

export const deleteChat = (chat: ChatRef, projectId: string) =>
  queryOne(DELETE_CHAT, [chat.platform, chat.chatId, projectId]);

export const dropChat = (chat: ChatRef) => query(DROP_CHAT, [chat.platform, chat.chatId]);

export const migrateChat = (chat: ChatRef, newChatId: string) =>
  query(MIGRATE_CHAT, [chat.platform, chat.chatId, newChatId]);

export const queueNotification = (
  projectId: string,
  kind: NotifyKind,
  payload: unknown,
  actorId: string | null,
) => query(QUEUE_NOTIFICATION, [projectId, kind, JSON.stringify(payload), actorId]);

export const linkedPlatforms = (userId: string) =>
  query<{ platform: BotPlatform }>(LINKED_PLATFORMS, [userId]).then(
    (rows) => new Set(rows.map((row) => row.platform)),
  );

export const openTasks = (
  projectId: string,
  assigneeId: string | null,
  limit: number,
  viewerId: string | null,
) =>
  query<{ number: number; title: string; due_date: string | null; assignee: string | null }>(OPEN_TASKS, [
    projectId,
    assigneeId,
    limit,
    viewerId,
  ]);

export const statusName = (statusId: string) =>
  queryOne<{ name: string }>(STATUS_NAME, [statusId]).then((row) => row?.name ?? null);
