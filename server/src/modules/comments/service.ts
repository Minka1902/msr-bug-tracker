import type { Comment } from '@msr/shared/types';
import { query, queryOne, transaction } from '../../db/pool';
import { badRequest } from '../../lib/httpError';
import { linkCommentAttachments } from '../attachments/service';
import { recordActivity } from '../tasks/activity';
import { avatarUrl } from '../users/service';

interface CommentRow {
  id: string;
  task_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_key: string | null;
  body: string;
  created_at: Date;
  edited_at: Date | null;
}

const COMMENT_SELECT = `
  SELECT c.id, c.task_id, c.parent_id, c.author_id, u.name AS author_name, u.avatar_key AS author_avatar_key, c.body, c.created_at, c.edited_at
  FROM task_comments c LEFT JOIN users u ON u.id = c.author_id`;
const INSERT_COMMENT =
  'INSERT INTO task_comments (task_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4) RETURNING id';
const BUMP_COMMENTS =
  'UPDATE tasks SET comment_count = comment_count + $2 WHERE id = $1 RETURNING project_id';
const PARENT = 'SELECT parent_id FROM task_comments WHERE id = $1 AND task_id = $2';
const UPDATE_COMMENT = 'UPDATE task_comments SET body = $2, edited_at = now() WHERE id = $1';
const DELETE_COMMENT = `
  WITH removed AS (DELETE FROM task_comments WHERE id = $1 OR parent_id = $1 RETURNING task_id)
  UPDATE tasks SET comment_count = comment_count - (SELECT count(*) FROM removed) WHERE id = $2`;

export const toComment = (row: CommentRow): Comment => ({
  id: row.id,
  parentId: row.parent_id,
  author: {
    id: row.author_id ?? '',
    name: row.author_name ?? 'Deleted user',
    avatarUrl: row.author_id ? avatarUrl(row.author_id, row.author_avatar_key) : null,
  },
  body: row.body,
  createdAt: row.created_at.toISOString(),
  editedAt: row.edited_at?.toISOString() ?? null,
});

export const getCommentRow = (id: string) =>
  queryOne<CommentRow>(`${COMMENT_SELECT} WHERE c.id = $1`, [id]).catch(() => undefined);

export const listComments = (taskId: string) =>
  query<CommentRow>(`${COMMENT_SELECT} WHERE c.task_id = $1 ORDER BY c.created_at, c.id`, [taskId]).then(
    (rows) => rows.map(toComment),
  );

export const createComment = (
  taskId: string,
  authorId: string,
  input: { body: string; parentId?: string | null; attachmentIds?: string[] },
) =>
  transaction(async (db) => {
    if (input.parentId) {
      const parent = await queryOne<{ parent_id: string | null }>(PARENT, [input.parentId, taskId], db);
      if (!parent || parent.parent_id) throw badRequest('Replies can only be added to top-level comments');
    }
    const created = await queryOne<{ id: string }>(
      INSERT_COMMENT,
      [taskId, authorId, input.parentId ?? null, input.body],
      db,
    );
    const task = await queryOne<{ project_id: string }>(BUMP_COMMENTS, [taskId, 1], db);
    if (input.attachmentIds?.length)
      await linkCommentAttachments(db, taskId, created!.id, input.attachmentIds, authorId);
    await recordActivity(
      [{ projectId: task!.project_id, taskId, actorId: authorId, action: 'commented' }],
      db,
    );
    return toComment((await queryOne<CommentRow>(`${COMMENT_SELECT} WHERE c.id = $1`, [created!.id], db))!);
  });

export const updateComment = async (
  comment: Pick<CommentRow, 'id' | 'task_id'>,
  editorId: string,
  input: { body: string; attachmentIds?: string[] },
) => {
  await transaction(async (db) => {
    await query(UPDATE_COMMENT, [comment.id, input.body], db);
    if (input.attachmentIds?.length)
      await linkCommentAttachments(db, comment.task_id, comment.id, input.attachmentIds, editorId);
  });
  return toComment((await getCommentRow(comment.id))!);
};

export const deleteComment = (id: string, taskId: string) => query(DELETE_COMMENT, [id, taskId]);
