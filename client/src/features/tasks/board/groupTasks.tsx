import { UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { PRIORITIES, PRIORITY_META, TYPE_META } from '@msr/shared/enums';
import { MODULE_META } from '@msr/shared/modules';
import type { UpdateTaskInput } from '@msr/shared/schemas/task';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { OptionDot } from '../../../components/ui/OptionPicker';
import { PriorityIcon, TypeIcon } from '../taskMeta';

export type GroupBy = 'none' | 'type' | 'priority' | 'assignee' | 'label';

export interface Lane {
  key: string;
  label: string;
  icon?: ReactNode;
  tasks: TaskCard[];
  patch?: { input: UpdateTaskInput; optimistic: Partial<TaskCard> };
}

export const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'type', label: 'Type' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'label', label: 'First label' },
];

const NONE = 'none';

export const laneKeyOf = (task: TaskCard, groupBy: GroupBy) => {
  if (groupBy === 'type') return task.type;
  if (groupBy === 'priority') return task.priority;
  if (groupBy === 'assignee') return task.assignee?.id ?? NONE;
  if (groupBy === 'label') return task.labels[0]?.id ?? NONE;
  return 'all';
};

export const groupTasks = (tasks: TaskCard[], groupBy: GroupBy, project: ProjectDetail): Lane[] => {
  const byKey = (key: string) => tasks.filter((task) => laneKeyOf(task, groupBy) === key);

  if (groupBy === 'type')
    return MODULE_META[project.module].taskTypes
      .map((type) => ({
        key: type,
        label: TYPE_META[type].label,
        icon: <TypeIcon type={type} />,
        tasks: byKey(type),
        patch: { input: { type }, optimistic: { type } },
      }))
      .filter((lane) => lane.tasks.length);

  if (groupBy === 'priority')
    return PRIORITIES.map((priority) => ({
      key: priority,
      label: PRIORITY_META[priority].label,
      icon: <PriorityIcon priority={priority} decorative />,
      tasks: byKey(priority),
      patch: { input: { priority }, optimistic: { priority } },
    }));

  if (groupBy === 'assignee') {
    const present = new Set(tasks.map((task) => task.assignee?.id ?? NONE));
    return [
      ...project.memberList
        .filter((member) => present.has(member.id))
        .map((member) => ({
          key: member.id,
          label: member.name,
          icon: <Avatar name={member.name} src={member.avatarUrl} size="xs" decorative />,
          tasks: byKey(member.id),
          patch: {
            input: { assigneeId: member.id },
            optimistic: { assignee: { id: member.id, name: member.name, avatarUrl: member.avatarUrl } },
          },
        })),
      {
        key: NONE,
        label: 'Unassigned',
        icon: <UserRound className="size-4 text-subtle" />,
        tasks: byKey(NONE),
        patch: { input: { assigneeId: null }, optimistic: { assignee: null } },
      },
    ];
  }

  if (groupBy === 'label') {
    const present = new Set(tasks.map((task) => task.labels[0]?.id ?? NONE));
    return [
      ...project.labels
        .filter((label) => present.has(label.id))
        .map((label) => ({
          key: label.id,
          label: label.name,
          icon: <OptionDot color={label.color} />,
          tasks: byKey(label.id),
        })),
      { key: NONE, label: 'No label', tasks: byKey(NONE) },
    ];
  }

  return [{ key: 'all', label: '', tasks }];
};
