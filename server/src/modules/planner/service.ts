import { MODULE_META } from '@msr/shared/modules';
import {
  DOERS,
  PLAN_TASKS_MAX,
  type Doer,
  type IdeaInput,
  type Pace,
  type PlanQuestion,
  type PlanRequest,
  type PlanTask,
} from '@msr/shared/schemas/planner';
import { z } from 'zod';
import { generateJson } from '../../lib/ai';
import { findOwnWorker } from '../agents/service';
import { openApiKey } from '../aiKeys/service';
import { commitImport } from '../importer/commit';
import { emptyTask, type NormalizedTask } from '../importer/types';
import { addMember, getMember } from '../members/service';
import { assertCanWrite, assertCovers, type ProjectContext } from '../projects/access';
import { listRoles } from '../roles/service';
import { DEFAULT_PREFERENCES, type UserRow } from '../users/service';
import { BASE_RULES, planPrompt, questionsPrompt } from './prompts';

const QUESTIONS_MAX = 6;
const CHOICES_MAX = 6;
const STEPS_MAX = 8;
const DAY_MS = 86_400_000;
const PACE_DAYS: Record<Pace, number> = { relaxed: 7, steady: 3, intense: 1 };
const DOER_LABELS: Record<Exclude<Doer, 'human'>, string> = { ai: 'AI', skill: 'Skill' };

const QUESTIONS_WIRE = z.object({
  questions: z.array(z.object({ question: z.string(), choices: z.array(z.string()) })),
});
const PLAN_WIRE = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      doer: z.enum(DOERS),
      summary: z.string(),
      steps: z.array(z.string()),
      skill: z.string().nullable(),
      prompt: z.string().nullable(),
    }),
  ),
});

const clip = (value: string, max: number) => value.trim().slice(0, max);

const localToday = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

const addDays = (day: string, days: number) =>
  new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10);

const keyFor = (user: UserRow) => openApiKey(user.id, user.preferences.aiProvider ?? null);

const describe = (task: PlanTask) => {
  const what = `**What:** ${task.summary || task.title}`;
  if (task.doer === 'human')
    return `${what}\n\n**When:** ${task.dueDate ? `by ${task.dueDate}` : 'when you are ready'}\n\n**How:** tick off the steps in the checklist.`;
  const skill = task.skill ? `\n\n**Skill to run:** \`${task.skill}\`` : '';
  const prompt = task.prompt
    ? `\n\n**Prompt for the AI worker:**\n\n${task.prompt
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}`
    : '';
  return `${what}${skill}${prompt}`;
};

const ensureWorkerMember = async (project: ProjectContext, actorId: string, workerId: string) => {
  const worker = await findOwnWorker(actorId, workerId);
  if (await getMember(project.id, worker.id)) return worker;
  assertCanWrite(project, 'project.manage_members');
  const role = (await listRoles(project.id)).find((item) => item.systemKey === 'member')!;
  assertCovers(project, role.permissions);
  await addMember(project.id, worker.id, role.id);
  return worker;
};

export const askQuestions = async (user: UserRow, idea: IdeaInput): Promise<PlanQuestion[]> => {
  const { questions } = await generateJson({
    ...(await keyFor(user)),
    name: 'plan_questions',
    system: BASE_RULES,
    prompt: questionsPrompt(idea.module, idea.name, idea.description),
    schema: QUESTIONS_WIRE,
  });
  return questions
    .map((item) => ({
      question: clip(item.question, 300),
      choices: item.choices
        .map((choice) => clip(choice, 120))
        .filter(Boolean)
        .slice(0, CHOICES_MAX),
    }))
    .filter((item) => item.question)
    .slice(0, QUESTIONS_MAX);
};

export const draftPlan = async (user: UserRow, request: PlanRequest): Promise<PlanTask[]> => {
  const motivation = { ...DEFAULT_PREFERENCES.motivation, ...user.preferences.motivation };
  const { tasks } = await generateJson({
    ...(await keyFor(user)),
    name: 'project_plan',
    system: BASE_RULES,
    prompt: planPrompt(request.module, request.name, request.description, request.answers, motivation),
    schema: PLAN_WIRE,
  });
  const today = localToday(user.preferences.timezone ?? DEFAULT_PREFERENCES.timezone);
  const kept = tasks.filter((task) => task.title.trim()).slice(0, PLAN_TASKS_MAX);
  const humanIndex = new Map(
    kept.filter((task) => task.doer === 'human').map((task, index) => [task, index] as const),
  );
  return kept.map((task) => ({
    title: clip(task.title, 300),
    doer: task.doer,
    summary: clip(task.summary, 2000),
    steps:
      task.doer === 'human'
        ? task.steps
            .map((step) => clip(step, 500))
            .filter(Boolean)
            .slice(0, STEPS_MAX)
        : [],
    skill: task.doer === 'skill' && task.skill?.trim() ? clip(task.skill, 120) : null,
    prompt: task.doer !== 'human' && task.prompt?.trim() ? clip(task.prompt, 4000) : null,
    dueDate: humanIndex.has(task) ? addDays(today, humanIndex.get(task)! * PACE_DAYS[motivation.pace]) : null,
  }));
};

export const commitPlan = async (
  project: ProjectContext,
  actor: UserRow,
  tasks: PlanTask[],
  agentId: string | null,
) => {
  const worker = agentId ? await ensureWorkerMember(project, actor.id, agentId) : null;
  const choreType = MODULE_META[project.module].taskTypes[0]!;
  const normalized = tasks.map((task): NormalizedTask => ({
    ...emptyTask(task.title),
    type: task.doer === 'human' ? choreType : 'task',
    statusCategory: 'todo',
    description: describe(task),
    assignee:
      task.doer === 'human'
        ? { email: actor.email, name: actor.name }
        : worker && { email: worker.email, name: worker.name },
    labels: task.doer === 'human' ? [] : [DOER_LABELS[task.doer]],
    dueDate: task.dueDate,
    checklist: task.steps.map((text) => ({ text, done: false })),
  }));
  return commitImport(project, normalized, actor.id, { source: 'AI plan' });
};
