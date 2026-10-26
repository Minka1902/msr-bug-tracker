import { PRIORITIES, SEVERITIES, TASK_TYPES } from '@msr/shared/enums';
import { emptyTask, type NormalizedTask } from './types';
import {
  parseList,
  parsePerson,
  parsePriority,
  parseSeverity,
  parseType,
  toIsoDate,
  toIsoTimestamp,
} from './values';

export const IMPORT_FIELDS = [
  'title',
  'type',
  'status',
  'priority',
  'severity',
  'assignee',
  'labels',
  'startDate',
  'dueDate',
  'description',
  'stepsToReproduce',
  'expectedBehavior',
  'actualBehavior',
  'externalId',
  'parentExternalId',
  'createdAt',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ColumnMapping = Record<string, ImportField | null>;

const ALIASES: Record<ImportField, string[]> = {
  title: ['title', 'task name', 'name', 'summary', 'issue title', 'card name', 'task'],
  type: ['type', 'issue type', 'task type', 'work item type'],
  status: ['status', 'state', 'list', 'list name', 'section', 'section/column', 'column', 'stage'],
  priority: ['priority'],
  severity: ['severity'],
  assignee: ['assignee email', 'assignee', 'assigned to', 'assignees', 'owner', 'members', 'responsible'],
  labels: ['labels', 'tags', 'label', 'tag'],
  startDate: ['start date', 'start', 'start on', 'start date text'],
  dueDate: ['due date', 'due', 'due on', 'deadline', 'target date', 'due date text'],
  description: ['description', 'notes', 'task content', 'content', 'desc', 'card description', 'body'],
  stepsToReproduce: ['steps to reproduce', 'steps'],
  expectedBehavior: ['expected result', 'expected behavior', 'expected'],
  actualBehavior: ['actual result', 'actual behavior', 'actual'],
  externalId: ['id', 'identifier', 'task id', 'issue key', 'key', 'issue id', 'card id', 'task custom id'],
  parentExternalId: ['parent id', 'parent', 'parent task', 'parent key', 'parent task id', 'parent issue'],
  createdAt: ['created', 'created at', 'date created', 'created date', 'creation date'],
};

export const TEMPLATE_COLUMNS: { header: string; field: ImportField; width: number; example: string[] }[] = [
  {
    header: 'Title',
    field: 'title',
    width: 36,
    example: ['Checkout button does nothing on Safari', 'Add dark mode toggle'],
  },
  { header: 'Type', field: 'type', width: 14, example: ['bug', 'feature'] },
  { header: 'Status', field: 'status', width: 16, example: ['To Do', 'Backlog'] },
  { header: 'Priority', field: 'priority', width: 12, example: ['high', 'medium'] },
  { header: 'Severity', field: 'severity', width: 12, example: ['major', ''] },
  { header: 'Assignee email', field: 'assignee', width: 26, example: ['dana@example.com', ''] },
  { header: 'Labels', field: 'labels', width: 22, example: ['checkout, safari', 'ui'] },
  { header: 'Start date', field: 'startDate', width: 13, example: ['', '2026-11-02'] },
  { header: 'Due date', field: 'dueDate', width: 13, example: ['2026-11-05', '2026-11-20'] },
  {
    header: 'Description',
    field: 'description',
    width: 40,
    example: ['Customers on Safari 18 cannot pay.', 'Follow the system theme by default.'],
  },
  {
    header: 'Steps to reproduce',
    field: 'stepsToReproduce',
    width: 32,
    example: ['1. Add an item\n2. Click Checkout', ''],
  },
  {
    header: 'Expected result',
    field: 'expectedBehavior',
    width: 24,
    example: ['The payment form opens', ''],
  },
  { header: 'Actual result', field: 'actualBehavior', width: 24, example: ['Nothing happens', ''] },
  { header: 'ID', field: 'externalId', width: 10, example: ['1', '2'] },
  { header: 'Parent ID', field: 'parentExternalId', width: 10, example: ['', ''] },
];

export const TEMPLATE_CHOICES: Partial<Record<ImportField, readonly string[]>> = {
  type: TASK_TYPES,
  priority: PRIORITIES,
  severity: SEVERITIES,
};

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[*:]/g, '');

export const detectMapping = (headers: string[]): ColumnMapping => {
  const mapping: ColumnMapping = Object.fromEntries(headers.map((header) => [header, null]));
  const normalized = headers.map(normalizeHeader);
  for (const field of IMPORT_FIELDS) {
    for (const alias of ALIASES[field]) {
      const index = normalized.findIndex(
        (header, position) => header === alias && mapping[headers[position]!] === null,
      );
      if (index !== -1) {
        mapping[headers[index]!] = field;
        break;
      }
    }
  }
  return mapping;
};

export const rowToTask = (row: Record<string, unknown>, mapping: ColumnMapping): NormalizedTask => {
  const values: Partial<Record<ImportField, unknown>> = {};
  for (const [header, field] of Object.entries(mapping))
    if (field && values[field] === undefined) values[field] = row[header];
  const text = (field: ImportField) =>
    values[field] === undefined || values[field] === null ? '' : String(values[field]).trim();
  const type = parseType(text('type'));
  return {
    ...emptyTask(text('title')),
    externalId: text('externalId') || null,
    parentExternalId: text('parentExternalId') || null,
    description: text('description'),
    type,
    status: text('status') || null,
    priority: parsePriority(text('priority')),
    severity: type === 'bug' ? parseSeverity(text('severity')) : null,
    assignee: parsePerson(text('assignee')),
    labels: parseList(text('labels')),
    startDate: toIsoDate(values.startDate),
    dueDate: toIsoDate(values.dueDate),
    createdAt: toIsoTimestamp(values.createdAt),
    stepsToReproduce: text('stepsToReproduce'),
    expectedBehavior: text('expectedBehavior'),
    actualBehavior: text('actualBehavior'),
  };
};
