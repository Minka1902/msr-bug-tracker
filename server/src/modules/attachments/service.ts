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
const UNREFERENCED_KEYS =
  'SELECT key FROM unnest($1::text[]) AS key WHERE NOT EXISTS (SELECT 1 FROM attachments WHERE storage_key = key)';
const COPY_TEXT_FILES = `
  WITH source AS (
    SELECT x.id AS task_id, a.id AS old_id, gen_random_uuid() AS new_id, a.uploader_id, a.storage_key, a.name, a.mime, a.size,
           a.created_at, t.description, t.steps_to_reproduce, t.expected_behavior, t.actual_behavior
    FROM unnest($1::uuid[], $2::uuid[]) AS x(id, source_id)
    JOIN tasks t ON t.id = x.id
    JOIN attachments a ON a.task_id = x.source_id AND a.comment_id IS NULL
    WHERE strpos(concat_ws(' ', t.description, t.steps_to_reproduce, t.expected_behavior, t.actual_behavior), a.id::text) > 0
  ), copied AS (
    INSERT INTO attachments (id, task_id, uploader_id, storage_key, name, mime, size, created_at)
    SELECT new_id, task_id, uploader_id, storage_key, name, mime, size, created_at FROM source
  )
  SELECT task_id, old_id, new_id, description, steps_to_reproduce, expected_behavior, actual_behavior FROM source`;
const REWRITE_TEXTS = `
  UPDATE tasks t SET description = x.description, steps_to_reproduce = x.steps, expected_behavior = x.expected,
         actual_behavior = x.actual, attachment_count = t.attachment_count + x.files
  FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[])
    AS x(id, description, steps, expected, actual, files)
  WHERE t.id = x.id`;

interface CopiedFile {
  task_id: string;
  old_id: string;
  new_id: string;
  description: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
}

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
  await removeUnreferenced([removed?.storage_key]);
};

export const removeUnreferenced = async (keys: (string | null | undefined)[]) => {
  const candidates = keys.filter((key): key is string => !!key);
  if (candidates.length)
    await removeStored((await query<{ key: string }>(UNREFERENCED_KEYS, [candidates])).map((row) => row.key));
};

export const copyTextAttachments = async (db: Db, taskIds: string[], sourceIds: string[]) => {
  const copies = await query<CopiedFile>(COPY_TEXT_FILES, [taskIds, sourceIds], db);
  if (!copies.length) return;
  const tasks = new Map<string, CopiedFile[]>();
  copies.forEach((copy) => tasks.set(copy.task_id, [...(tasks.get(copy.task_id) ?? []), copy]));
  const rewrite = (text: string | null, files: CopiedFile[]) =>
    text && files.reduce((next, file) => next.replaceAll(file.old_id, file.new_id), text);
  const rows = [...tasks.values()];
  await query(
    REWRITE_TEXTS,
    [
      rows.map((files) => files[0]!.task_id),
      rows.map((files) => rewrite(files[0]!.description, files)),
      rows.map((files) => rewrite(files[0]!.steps_to_reproduce, files)),
      rows.map((files) => rewrite(files[0]!.expected_behavior, files)),
      rows.map((files) => rewrite(files[0]!.actual_behavior, files)),
      rows.map((files) => files.length),
    ],
    db,
  );
};

export const purgePendingAttachments = async () =>
  removeStored((await query<{ storage_key: string }>(PURGE_PENDING)).map((row) => row.storage_key));
