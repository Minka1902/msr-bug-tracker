import type { Priority, Reproducibility, Severity, StatusCategory, TaskType } from '@msr/shared/enums';
import type { Label, TaskCard, TaskDetail, TaskRecurrence } from '@msr/shared/types';
import { formatIdentifier } from '@msr/shared/identifiers';
import { avatarUrl } from '../users/service';

export interface CardRow {
  id: string;
  project_id: string;
  project_key: string;
  number: number;
  parent_id: string | null;
  type: TaskType;
  title: string;
  status_id: string;
  status_category: StatusCategory;
  priority: Priority;
  severity: Severity | null;
  reporter_id: string | null;
  start_date: string | null;
  due_date: string | null;
  recurrence: TaskRecurrence | null;
  is_blocked: boolean;
  position: string;
  comment_count: number;
  attachment_count: number;
  checklist_total: number;
  checklist_done: number;
  subtask_total: number;
  subtask_done: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar_key: string | null;
  labels: Label[];
  cover_id: string | null;
  parent_number: number | null;
}

export interface DetailRow extends CardRow {
  description: string;
  blocked_reason: string | null;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
  env_os: string;
  env_browser: string;
  env_app_version: string;
  found_in_version: string;
  fix_version: string;
  reproducibility: Reproducibility | null;
  reporter_name: string | null;
  reporter_avatar_key: string | null;
  parent_title: string | null;
}

const CARD_COLUMNS = `
  t.id, t.project_id, p.key::text AS project_key, t.number, t.parent_id, t.type, t.title, t.status_id, s.category AS status_category,
  t.priority, t.severity, t.reporter_id, t.start_date, t.due_date, t.recurrence, t.is_blocked, t.position,
  t.comment_count, t.attachment_count, t.checklist_total, t.checklist_done, t.subtask_total, t.subtask_done,
  t.created_at, t.updated_at, t.completed_at,
  a.id AS assignee_id, a.name AS assignee_name, a.avatar_key AS assignee_avatar_key,
  COALESCE((SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color) ORDER BY lower(l.name))
            FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id = t.id), '[]') AS labels,
  CASE WHEN t.attachment_count > 0 THEN
    (SELECT f.id FROM attachments f WHERE f.task_id = t.id AND f.mime LIKE 'image/%' ORDER BY f.created_at LIMIT 1)
  END AS cover_id,
  CASE WHEN t.parent_id IS NOT NULL THEN (SELECT pt.number FROM tasks pt WHERE pt.id = t.parent_id) END AS parent_number`;

export const TASK_FROM = `
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  JOIN project_statuses s ON s.id = t.status_id
  LEFT JOIN users a ON a.id = t.assignee_id`;

export const cardSelect = (extraColumns = '') =>
  `SELECT ${CARD_COLUMNS}${extraColumns ? `, ${extraColumns}` : ''} ${TASK_FROM}`;

export const DETAIL_SELECT = `
  SELECT ${CARD_COLUMNS},
         t.description, t.blocked_reason, t.steps_to_reproduce, t.expected_behavior, t.actual_behavior, t.env_os, t.env_browser,
         t.env_app_version, t.found_in_version, t.fix_version, t.reproducibility,
         r.name AS reporter_name, r.avatar_key AS reporter_avatar_key, pt.title AS parent_title
  ${TASK_FROM}
  LEFT JOIN users r ON r.id = t.reporter_id
  LEFT JOIN tasks pt ON pt.id = t.parent_id`;

export const toCard = (row: CardRow): TaskCard => ({
  id: row.id,
  projectId: row.project_id,
  projectKey: row.project_key,
  number: row.number,
  identifier: formatIdentifier(row.project_key, row.number),
  parentId: row.parent_id,
  parentIdentifier: row.parent_number ? formatIdentifier(row.project_key, row.parent_number) : null,
  type: row.type,
  title: row.title,
  statusId: row.status_id,
  statusCategory: row.status_category,
  priority: row.priority,
  severity: row.severity,
  assignee: row.assignee_id
    ? {
        id: row.assignee_id,
        name: row.assignee_name!,
        avatarUrl: avatarUrl(row.assignee_id, row.assignee_avatar_key),
      }
    : null,
  reporterId: row.reporter_id,
  labels: row.labels,
  startDate: row.start_date,
  dueDate: row.due_date,
  recurrence: row.recurrence,
  isBlocked: row.is_blocked,
  position: row.position,
  commentCount: row.comment_count,
  attachmentCount: row.attachment_count,
  checklistTotal: row.checklist_total,
  checklistDone: row.checklist_done,
  subtaskTotal: row.subtask_total,
  subtaskDone: row.subtask_done,
  coverUrl: row.cover_id ? `/api/attachments/${row.cover_id}` : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  completedAt: row.completed_at?.toISOString() ?? null,
});

export const toDetail = (row: DetailRow): TaskDetail => ({
  ...toCard(row),
  description: row.description,
  blockedReason: row.blocked_reason,
  reporter: row.reporter_id
    ? {
        id: row.reporter_id,
        name: row.reporter_name!,
        avatarUrl: avatarUrl(row.reporter_id, row.reporter_avatar_key),
      }
    : null,
  parent: row.parent_id
    ? {
        id: row.parent_id,
        identifier: formatIdentifier(row.project_key, row.parent_number!),
        title: row.parent_title!,
      }
    : null,
  stepsToReproduce: row.steps_to_reproduce,
  expectedBehavior: row.expected_behavior,
  actualBehavior: row.actual_behavior,
  envOs: row.env_os,
  envBrowser: row.env_browser,
  envAppVersion: row.env_app_version,
  foundInVersion: row.found_in_version,
  fixVersion: row.fix_version,
  reproducibility: row.reproducibility,
});
