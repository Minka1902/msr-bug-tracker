import { differenceInCalendarDays } from 'date-fns';
import { PRIORITIES, PRIORITY_META, STATUS_CATEGORIES, STATUS_CATEGORY_META } from '@msr/shared/enums';
import type { ProjectSummary, TaskCard } from '@msr/shared/types';
import { toDate } from '../../lib/dates';

export type MyTasksGrouping = 'deadline' | 'project' | 'priority' | 'status';

export interface TaskGroup {
  key: string;
  label: string;
  tone?: string;
  tasks: TaskCard[];
}

const DEADLINE_GROUPS = [
  { key: 'overdue', label: 'Overdue', tone: 'var(--tone-danger)' },
  { key: 'today', label: 'Today', tone: 'var(--tone-warning)' },
  { key: 'week', label: 'Next 7 days', tone: 'var(--tone-accent)' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No due date' },
  { key: 'done', label: 'Completed', tone: 'var(--tone-success)' },
];

const deadlineKey = (task: TaskCard) => {
  if (task.statusCategory === 'done') return 'done';
  if (!task.dueDate) return 'none';
  const days = differenceInCalendarDays(toDate(task.dueDate), new Date());
  return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'week' : 'later';
};

export const groupMyTasks = (
  tasks: TaskCard[],
  grouping: MyTasksGrouping,
  projects: ProjectSummary[],
): TaskGroup[] => {
  const groups: TaskGroup[] =
    grouping === 'deadline'
      ? DEADLINE_GROUPS.map((group) => ({
          ...group,
          tasks: tasks.filter((task) => deadlineKey(task) === group.key),
        }))
      : grouping === 'priority'
        ? PRIORITIES.map((priority) => ({
            key: priority,
            label: PRIORITY_META[priority].label,
            tone: `var(--tone-${PRIORITY_META[priority].tone})`,
            tasks: tasks.filter((task) => task.priority === priority),
          }))
        : grouping === 'status'
          ? STATUS_CATEGORIES.map((category) => ({
              key: category,
              label: STATUS_CATEGORY_META[category].label,
              tone: `var(--tone-${STATUS_CATEGORY_META[category].tone})`,
              tasks: tasks.filter((task) => task.statusCategory === category),
            }))
          : projects.map((project) => ({
              key: project.key,
              label: project.name,
              tone: project.color,
              tasks: tasks.filter((task) => task.projectKey === project.key),
            }));
  return groups.filter((group) => group.tasks.length > 0);
};
