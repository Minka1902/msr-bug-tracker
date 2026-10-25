import {
  Ban,
  Bug,
  CalendarClock,
  CircleCheck,
  CircleDot,
  Flag,
  GitBranch,
  Shapes,
  Tag,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { STATUS_CATEGORIES, STATUS_CATEGORY_META } from '@msr/shared/enums';
import type { FilterDef } from '../../components/ui/FilterBar';
import type { TaskOptions } from './useTaskOptions';

interface TaskFilterDefsOptions {
  bugsOnly?: boolean;
  byCategory?: boolean;
}

export const taskFilterDefs = (
  options: TaskOptions,
  { bugsOnly, byCategory }: TaskFilterDefsOptions = {},
): FilterDef[] => [
  byCategory
    ? {
        key: 'category',
        label: 'Status',
        icon: <CircleDot />,
        type: 'multi',
        options: STATUS_CATEGORIES.map((value) => ({
          value,
          label: STATUS_CATEGORY_META[value].label,
          color: `var(--tone-${STATUS_CATEGORY_META[value].tone})`,
        })),
      }
    : {
        key: 'status',
        label: 'Status',
        icon: <CircleDot />,
        type: 'multi',
        options: options.status(bugsOnly ? 'bug' : undefined),
      },
  ...(bugsOnly
    ? []
    : [{ key: 'type', label: 'Type', icon: <Shapes />, type: 'multi' as const, options: options.type }]),
  { key: 'priority', label: 'Priority', icon: <Flag />, type: 'multi', options: options.priority },
  { key: 'severity', label: 'Severity', icon: <Bug />, type: 'multi', options: options.severity },
  {
    key: 'assignee',
    label: 'Assignee',
    icon: <UserRound />,
    type: 'multi',
    options: [{ value: 'me', label: 'Me' }, { value: 'none', label: 'Unassigned' }, ...options.assignee],
  },
  { key: 'label', label: 'Label', icon: <Tag />, type: 'multi', options: options.label },
  { key: 'dueFrom', toKey: 'dueTo', label: 'Due', icon: <CalendarClock />, type: 'dateRange' },
  { key: 'createdFrom', toKey: 'createdTo', label: 'Created', type: 'dateRange' },
  { key: 'overdue', label: 'Overdue', icon: <TriangleAlert />, type: 'toggle' },
  { key: 'blocked', label: 'Blocked', icon: <Ban />, type: 'toggle' },
  { key: 'hideDone', label: 'Hide completed', icon: <CircleCheck />, type: 'toggle' },
  { key: 'topLevel', label: 'Hide subtasks', icon: <GitBranch />, type: 'toggle' },
];
