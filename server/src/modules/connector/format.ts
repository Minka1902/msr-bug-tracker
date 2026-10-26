import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TaskCard } from '@msr/shared/types';
import { config } from '../../config';

export const appUrl = (path: string) => new URL(path, config.APP_URL).href;
export const taskUrl = (identifier: string) => appUrl(`/t/${identifier}`);
export const projectUrl = (key: string) => appUrl(`/p/${key}`);

export const result = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
});

export const failure = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

export const compactTask = (task: TaskCard, statusNames: Map<string, string>) => ({
  identifier: task.identifier,
  title: task.title,
  type: task.type,
  status: statusNames.get(task.statusId) ?? task.statusCategory,
  statusCategory: task.statusCategory,
  priority: task.priority,
  ...(task.escalation && { escalation: `${task.escalation.from} → ${task.escalation.to}` }),
  ...(task.severity && { severity: task.severity }),
  assignee: task.assignee?.name ?? null,
  dueDate: task.dueDate,
  ...(task.startDate && { startDate: task.startDate }),
  ...(task.labels.length && { labels: task.labels.map((label) => label.name) }),
  ...(task.parentIdentifier && { parent: task.parentIdentifier }),
  ...(task.isBlocked && { blocked: true }),
  ...(task.subtaskTotal && { subtasks: `${task.subtaskDone}/${task.subtaskTotal}` }),
  ...(task.checklistTotal && { checklist: `${task.checklistDone}/${task.checklistTotal}` }),
  url: taskUrl(task.identifier),
});
