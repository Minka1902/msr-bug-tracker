import { PRIORITY_RANK, type Priority } from '@msr/shared/enums';
import type { ActivityEntry } from '@msr/shared/types';

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  type: 'type',
  status: 'status',
  priority: 'priority',
  severity: 'severity',
  assignee: 'assignee',
  labels: 'labels',
  startDate: 'start date',
  dueDate: 'due date',
  escalation: 'priority schedule',
  isBlocked: 'blocked flag',
  blockedReason: 'blocked reason',
  stepsToReproduce: 'steps to reproduce',
  expectedBehavior: 'expected behavior',
  actualBehavior: 'actual behavior',
  envOs: 'OS',
  envBrowser: 'browser',
  envAppVersion: 'app version',
  foundInVersion: 'found-in version',
  fixVersion: 'fix version',
  reproducibility: 'reproducibility',
};

const show = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'none';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
};

export const activityText = (entry: ActivityEntry) => {
  if (entry.action === 'created')
    return entry.field === 'duplicated_from'
      ? `duplicated this from ${show(entry.newValue)}`
      : 'created this task';
  if (entry.action === 'deleted') return `deleted ${entry.task?.identifier ?? 'a task'}`;
  if (entry.action === 'moved') return `moved this from ${show(entry.oldValue)} to ${show(entry.newValue)}`;
  if (entry.action === 'commented') return 'commented';
  if (entry.action === 'attachment_added') return `attached ${show(entry.newValue)}`;
  if (entry.action === 'attachment_removed') return `removed attachment ${show(entry.oldValue)}`;
  if (entry.action === 'relation_added') return `linked ${show(entry.newValue)}`;
  if (entry.action === 'relation_removed') return `unlinked ${show(entry.oldValue)}`;
  if (entry.action === 'escalated')
    return `${PRIORITY_RANK[entry.newValue as Priority] < PRIORITY_RANK[entry.oldValue as Priority] ? 'raised' : 'lowered'} the priority from ${show(entry.oldValue)} to ${show(entry.newValue)}`;
  const field = FIELD_LABELS[entry.field ?? ''] ?? entry.field ?? 'something';
  if (entry.field === 'labels' && entry.oldValue === null) return `added label ${show(entry.newValue)}`;
  if (entry.field === 'labels' && entry.newValue === null) return `removed label ${show(entry.oldValue)}`;
  if (entry.oldValue === null && entry.newValue === null) return `updated the ${field}`;
  if (entry.field === 'isBlocked') return entry.newValue ? 'marked this as blocked' : 'unblocked this';
  return `changed ${field} from ${show(entry.oldValue)} to ${show(entry.newValue)}`;
};
