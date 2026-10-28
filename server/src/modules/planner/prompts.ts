import type { ProjectModule } from '@msr/shared/modules';
import type { AiShare, Motivation, Pace, TaskSize } from '@msr/shared/schemas/planner';

export const BASE_RULES = `You are the planning coach inside MSR Tracker, a task tracker.
You help a person turn an idea into small, concrete steps so they keep moving and never feel overwhelmed by the size of the idea.
Write in the language the person wrote in. Be warm, short and specific. Never invent facts about the person.`;

export const MODULE_PROMPTS: Record<ProjectModule, string> = {
  software:
    'This is a software project for a team. Plan discovery, design, building, testing and release work, in the words engineers use.',
  personal:
    'This is a personal project or goal. Plan it around the time and energy of one person, with early wins that build momentum.',
  household:
    'This is a household. Plan chores, errands, purchases and family logistics, and spread the work fairly between family members.',
  skill:
    "This is skill development. Build a practice plan from the person's current level to their goal: theory, deliberate practice, small projects and regular reviews, spaced over time.",
  startup:
    'This is a startup idea. Validate the problem with real people before building anything, then plan the smallest product that proves it, the launch and the first customers. Include legal, money and pricing basics.',
};

const PACE_TEXT: Record<Pace, string> = {
  relaxed: 'a relaxed pace, about one task for the person a week',
  steady: 'a steady pace, a task for the person every few days',
  intense: 'an intense pace, a task for the person every day',
};

const SIZE_TEXT: Record<TaskSize, string> = {
  tiny: 'Each task for the person takes 15 minutes or less.',
  small: 'Each task for the person takes about an hour.',
  medium: 'Each task for the person takes about half a day.',
};

const SHARE_TEXT: Record<AiShare, string> = {
  max: 'Give a task to the AI whenever it can do it without a person. A task goes to the person only when it truly needs them: decisions, physical actions, payments, accounts, or talking to people.',
  balanced:
    'Split the work between the person and the AI where it makes sense. The person keeps the creative and decision-making work.',
  human: 'Keep most of the work with the person. Give the AI only research, drafting and summarizing.',
};

const QUESTION_RULES = `Ask 3 to 6 short questions that reveal the scale, the goal, the deadline, the budget, the person's skills and their constraints.
Offer 2 to 5 short answer choices when they fit; leave choices empty for open questions. Do not repeat what the description already says.`;

const PLAN_RULES = `Break the idea into 8 to 25 tasks in the order they should be done. The first task must be a small win the person can do today.
Each task has:
- title: a short imperative, like "Call three gyms for prices"
- doer: "human", "ai" for work an AI assistant can do on its own, or "skill" when a Claude skill or slash command fits best
- summary: one or two sentences on what to do and why it matters
- steps: for "human" tasks, 2 to 6 short steps that explain how to do it; for other tasks, an empty list
- skill: for "skill" tasks, the skill or slash command to run, like "/brainstorming"; otherwise null
- prompt: for "ai" and "skill" tasks, the full instruction to give the AI; otherwise null`;

const ideaText = (module: ProjectModule, name: string, description: string) =>
  `${MODULE_PROMPTS[module]}\n\nIdea: ${name}${description ? `\nDescription: ${description}` : ''}`;

export const questionsPrompt = (module: ProjectModule, name: string, description: string) =>
  `${ideaText(module, name, description)}\n\n${QUESTION_RULES}`;

export const planPrompt = (
  module: ProjectModule,
  name: string,
  description: string,
  answers: { question: string; answer: string }[],
  motivation: Motivation,
) =>
  [
    ideaText(module, name, description),
    answers.length
      ? `What the person told you:\n${answers.map((item) => `- ${item.question} ${item.answer || '(no answer)'}`).join('\n')}`
      : '',
    `Work at ${PACE_TEXT[motivation.pace]}. ${SIZE_TEXT[motivation.taskSize]} ${SHARE_TEXT[motivation.aiShare]}`,
    PLAN_RULES,
  ]
    .filter(Boolean)
    .join('\n\n');
