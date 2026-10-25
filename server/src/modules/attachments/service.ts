import type { Attachment } from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { removeStored } from '../../lib/storage';
import type { StoredFile } from '../../lib/upload';
import { recordActivity } from '../tasks/activity';
import { avatarUrl } from '../users/service';

export interface AttachmentRow {
  id: string;
  task_id: string | null;
  comment_id: string | null;
  uploader_id: string | null;
  storage_key: string;
  name: string;
  mime: string;
  size: number;
  created_at: Date;
  uploader_name: string | null;
  uploader_avatar_key: string | null;
}

const ATTACHMENT_SELECT = `
  SELECT f.id, f.task_id, f.comment_id, f.uploader_id, f.storage_key, f.name, f.mime, f.size, f.created_at,
         u.name AS uploader_name, u.avatar_key AS uploader_avatar_key
  FROM attachments f LEFT JOIN users u ON u.id = f.uploader_id`;

const INSERT_FILES = `
  INSERT INTO attachments (task_id, uploader_id, storage_key, name, mime, size, created_at)
  SELECT $1, $2, key, name, mime, size, clock_timestamp()
  FROM unnest($3::text[], $4::text[], $5::text[], $6::bigint[]) WITH ORDINALITY AS x(key, name, mime, size, ord) ORDER BY ord
  RETURNING id`;
const BUMP_COUNT =
  'UPDATE tasks SET attachment_count = attachment_count + $2, updated_at = now() WHERE id = $1 RETURNING project_id';
const DELETE_FILE = 'DELETE FROM attachments WHERE id = $1 RETURNING storage_key, task_id, name';
const LINK_TO_COMMENT = `
  WITH linked AS (
    UPDATE attachments SET task_id = $1, comment_id = $2
    WHERE id = ANY($3::uuid[]) AND task_id IS NULL AND uploader_id = $4 RETURNING id
  )
  UPDATE tasks SET attachment_count = attachment_count + (SELECT count(*) FROM linked) WHERE id = $1`;
const PURGE_PENDING =
  "DELETE FROM attachments WHERE task_id IS NULL AND created_at < now() - interval '24 hours' RETURNING storage_key";

export const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  name: row.name,
  mime: row.mime,
  size: Number(row.size),
  url: `/api/attachments/${row.id}`,
  uploader: {
    id: row.uploader_id ?? '',
    name: row.uploader_name ?? 'Deleted user',
    avatarUrl: row.uploader_id ? avatarUrl(row.uploader_id, row.uploader_avatar_key) : null,
  },
  commentId: row.comment_id,
  createdAt: row.created_at.toISOString(),
});

export const getAttachment = (id: string) =>
  queryOne<AttachmentRow>(`${ATTACHMENT_SELECT} WHERE f.id = $1`, [id]);

export const listAttachments = (taskId: string) =>
  query<AttachmentRow>(`${ATTACHMENT_SELECT} WHERE f.task_id = $1 ORDER BY f.created_at, f.storage_key`, [
    taskId,
  ]).then((rows) => rows.map(toAttachment));

const listByIds = (ids: string[], db?: Db) =>
  query<AttachmentRow>(
    `${ATTACHMENT_SELECT} WHERE f.id = ANY($1::uuid[]) ORDER BY f.created_at`,
    [ids],
    db,
  ).then((rows) => rows.map(toAttachment));

export const saveAttachments = async (files: StoredFile[], uploaderId: string, taskId: string | null) => {
  try {
    return await transaction(async (db) => {
      const rows = await query<{ id: string }>(
        INSERT_FILES,
        [
          taskId,
          uploaderId,
          files.map((file) => file.key),
          files.map((file) => file.name),
          files.map((file) => file.mime),
          files.map((file) => file.size),
        ],
        db,
      );
      if (taskId) {
        const task = await queryOne<{ project_id: string }>(BUMP_COUNT, [taskId, rows.length], db);
        await recordActivity(
          files.map((file) => ({
            projectId: task!.project_id,
            taskId,
            actorId: uploaderId,
            action: 'attachment_added',
            newValue: file.name,
          })),
          db,
        );
      }
      const order = rows.map((row) => row.id);
      return (await listByIds(order, db)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    });
  } catch (error) {
    await removeStored(files.map((file) => file.key));
    throw error;
  }
};

export const linkCommentAttachments = (
  db: Db,
  taskId: string,
  commentId: string,
  ids: string[],
  uploaderId: string,
) => query(LINK_TO_COMMENT, [taskId, commentId, ids, uploaderId], db);

export const deleteAttachment = async (id: string, actorId: string) => {
  const removed = await transaction(async (db) => {
    const row = await queryOne<{ storage_key: string; task_id: string | null; name: string }>(
      DELETE_FILE,
      [id],
      db,
    );
    if (row?.task_id) {
      const task = await queryOne<{ project_id: string }>(BUMP_COUNT, [row.task_id, -1], db);
      await recordActivity(
        [
          {
            projectId: task!.project_id,
            taskId: row.task_id,
            actorId,
            action: 'attachment_removed',
            oldValue: row.name,
          },
        ],
        db,
      );
    }
    return row;
  });
  await removeStored([removed?.storage_key]);
};

export const purgePendingAttachments = async () =>
  removeStored((await query<{ storage_key: string }>(PURGE_PENDING)).map((row) => row.storage_key));
