import { z } from 'zod';
import { PROJECT_MODULES } from '../modules';

export const DOERS = ['human', 'ai', 'skill'] as const;
export const PACES = ['relaxed', 'steady', 'intense'] as const;
export const TASK_SIZES = ['tiny', 'small', 'medium'] as const;
export const AI_SHARES = ['max', 'balanced', 'human'] as const;
export const PLAN_TASKS_MAX = 60;

export const motivationSchema = z.object({
  pace: z.enum(PACES),
  taskSize: z.enum(TASK_SIZES),
  aiShare: z.enum(AI_SHARES),
});

export const ideaSchema = z.object({
  module: z.enum(PROJECT_MODULES),
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(2000).default(''),
});

export const planQuestionSchema = z.object({
  question: z.string().trim().min(1).max(300),
  choices: z.array(z.string().trim().min(1).max(120)).max(6),
});

export const planRequestSchema = ideaSchema.extend({
  answers: z
    .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().max(1000) }))
    .max(10),
});

export const planTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  doer: z.enum(DOERS),
  summary: z.string().trim().max(2000),
  steps: z.array(z.string().trim().min(1).max(500)).max(8),
  skill: z.string().trim().max(120).nullable(),
  prompt: z.string().trim().max(4000).nullable(),
  dueDate: z.iso.date().nullable(),
});

export const commitPlanSchema = z.object({
  tasks: z.array(planTaskSchema).min(1, 'Keep at least one task').max(PLAN_TASKS_MAX),
  agentId: z.uuid().nullable().default(null),
});

export type Doer = (typeof DOERS)[number];
export type Pace = (typeof PACES)[number];
export type TaskSize = (typeof TASK_SIZES)[number];
export type AiShare = (typeof AI_SHARES)[number];
export type Motivation = z.infer<typeof motivationSchema>;
export type IdeaInput = z.infer<typeof ideaSchema>;
export type PlanQuestion = z.infer<typeof planQuestionSchema>;
export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanTask = z.infer<typeof planTaskSchema>;
