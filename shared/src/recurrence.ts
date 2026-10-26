import { addDays } from './calendar';
import { RECURRENCE_META } from './enums';
import type { TaskRecurrence } from './types';

const MAX_STEPS = 1000;

const addMonths = (isoDate: string, months: number) => {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
};

const step = (isoDate: string, rule: Pick<TaskRecurrence, 'freq' | 'interval'>) =>
  rule.freq === 'monthly'
    ? addMonths(isoDate, rule.interval)
    : addDays(isoDate, rule.freq === 'weekly' ? rule.interval * 7 : rule.interval);

export const nextOccurrence = (
  rule: Pick<TaskRecurrence, 'freq' | 'interval'>,
  dueDate: string | null,
  today: string,
) => {
  let next = step(dueDate ?? today, rule);
  for (let guard = 0; next <= today && guard < MAX_STEPS; guard += 1) next = step(next, rule);
  return next;
};

export const nextAssignee = (rule: Pick<TaskRecurrence, 'rotate'>, current: string | null) =>
  rule.rotate.length ? rule.rotate[(rule.rotate.indexOf(current ?? '') + 1) % rule.rotate.length]! : current;

export const describeRecurrence = (rule: Pick<TaskRecurrence, 'freq' | 'interval'>) => {
  const { unit } = RECURRENCE_META[rule.freq];
  return rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
};
