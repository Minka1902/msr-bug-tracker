import { z } from 'zod';
import {
  PRIORITIES,
  RECURRENCE_FREQUENCIES,
  REPRODUCIBILITY,
  SEVERITIES,
  STATUS_CATEGORIES,
  TASK_TYPES,
  WORKFLOWS,
} from '../enums';
import { positionSchema, projectKeySchema, uuidSchema } from './project';

export const isoDateSchema = z.iso.date('Use YYYY-MM-DD');

export const recurrenceSchema = z.object({
  freq: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1, 'At least 1').max(365, 'At most 365'),
  rotate: z.array(uuidSchema).max(20).default([]),
});

export const escalationSchema = z
  .object({ from: z.enum(PRIORITIES), to: z.enum(PRIORITIES) })
  .refine((value) => value.from !== value.to, 'Pick two different priorities');

const longText = z.string().max(20000);
const shortText = z.string().trim().max(120);

const taskFields = {
  type: z.enum(TASK_TYPES),
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: longText,
  statusId: uuidSchema,
  priority: z.enum(PRIORITIES),
  severity: z.enum(SEVERITIES).nullable(),
  assigneeId: uuidSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  dueDate: isoDateSchema.nullable(),
  labelIds: z.array(uuidSchema).max(30),
  isBlocked: z.boolean(),
  blockedReason: z.string().trim().max(500).nullable(),
  stepsToReproduce: longText,
  expectedBehavior: longText,
  actualBehavior: longText,
  envOs: shortText,
  envBrowser: shortText,
  envAppVersion: shortText,
  foundInVersion: shortText,
  fixVersion: shortText,
  reproducibility: z.enum(REPRODUCIBILITY).nullable(),
  recurrence: recurrenceSchema.nullable(),
  escalation: escalationSchema.nullable(),
};

const datesInOrder = (value: { startDate?: string | null; dueDate?: string | null }) =>
  !value.startDate || !value.dueDate || value.startDate <= value.dueDate;
const DATE_ORDER = { message: 'Start date must be on or before the due date', path: ['dueDate'] };
const SCHEDULE_NEEDS_DUE = { message: 'Set a due date to schedule the priority', path: ['escalation'] };

export const createTaskSchema = z
  .object({
    ...taskFields,
    parentId: uuidSchema.nullable(),
    position: positionSchema,
    attachmentIds: z.array(uuidSchema).max(20),
  })
  .partial()
  .required({ title: true })
  .refine(datesInOrder, DATE_ORDER)
  .refine((value) => !value.escalation || !!value.dueDate, SCHEDULE_NEEDS_DUE);

export const updateTaskSchema = z
  .object({ ...taskFields, position: positionSchema })
  .partial()
  .strict()
  .refine(datesInOrder, DATE_ORDER)
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

const idList = z.array(uuidSchema).min(1).max(500);

export const bulkUpdateSchema = z.object({
  ids: idList,
  patch: z
    .object({
      statusId: uuidSchema,
      statusCategory: z.enum(STATUS_CATEGORIES),
      priority: z.enum(PRIORITIES),
      severity: z.enum(SEVERITIES).nullable(),
      assigneeId: uuidSchema.nullable(),
      addLabelIds: z.array(uuidSchema).max(30),
      removeLabelIds: z.array(uuidSchema).max(30),
    })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
    .refine((value) => !(value.statusId && value.statusCategory), 'Choose a status or a category, not both'),
});

export const bulkDeleteSchema = z.object({ ids: idList });
export const moveTaskSchema = z.object({ projectKey: projectKeySchema });

const csv = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : []))
    .pipe(z.array(item).max(50));

const flag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export const TASK_SORTS = [
  'updated',
  'created',
  'due',
  'priority',
  'title',
  'status',
  'number',
  'assignee',
  'type',
] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export const taskFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: csv(uuidSchema),
  category: csv(z.enum(STATUS_CATEGORIES)),
  type: csv(z.enum(TASK_TYPES)),
  priority: csv(z.enum(PRIORITIES)),
  severity: csv(z.enum(SEVERITIES)),
  assignee: csv(z.union([uuidSchema, z.literal('me'), z.literal('none')])),
  label: csv(uuidSchema),
  project: csv(projectKeySchema),
  dueFrom: isoDateSchema.optional(),
  dueTo: isoDateSchema.optional(),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  overdue: flag,
  blocked: flag,
  hideDone: flag,
  topLevel: flag,
  sort: z.enum(TASK_SORTS).default('updated'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const boardQuerySchema = taskFilterSchema.extend({
  workflow: z.enum(WORKFLOWS).default('task'),
  statusId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type BulkPatch = z.infer<typeof bulkUpdateSchema>['patch'];
export type TaskFilters = z.infer<typeof taskFilterSchema>;
export type TaskFilterInput = z.input<typeof taskFilterSchema>;
