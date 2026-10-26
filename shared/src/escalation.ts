import { addDays } from './calendar';
import { PRIORITY_META, type Priority } from './enums';
import type { EscalationRange } from './types';

export const PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'] as const satisfies readonly Priority[];

const DAY_MS = 86_400_000;

export interface EscalationStep {
  priority: Priority;
  from: string;
}

export const escalationSteps = (range: EscalationRange, firstDay: string, dueDate: string) => {
  const start = firstDay < dueDate ? firstDay : dueDate;
  const span = (Date.parse(dueDate) - Date.parse(start)) / DAY_MS;
  const first = PRIORITY_LEVELS.indexOf(range.from);
  const last = PRIORITY_LEVELS.indexOf(range.to);
  const count = Math.abs(last - first) + 1;
  const steps: EscalationStep[] = [];
  for (let index = 0; index < count; index++) {
    const from = addDays(start, Math.ceil((index * span) / count));
    if (steps.at(-1)?.from === from) steps.pop();
    steps.push({ priority: PRIORITY_LEVELS[first + Math.sign(last - first) * index]!, from });
  }
  return steps;
};

export const escalatedPriority = (range: EscalationRange, firstDay: string, dueDate: string, today: string) =>
  escalationSteps(range, firstDay, dueDate).findLast((step) => step.from <= today)?.priority ?? range.from;

export const describeEscalation = (range: EscalationRange | null) =>
  range ? `${PRIORITY_META[range.from].label} → ${PRIORITY_META[range.to].label}` : null;
