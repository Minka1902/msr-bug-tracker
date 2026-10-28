import { useMemo } from 'react';
import {
  PRIORITIES,
  PRIORITY_META,
  REPRODUCIBILITY,
  REPRODUCIBILITY_META,
  SEVERITIES,
  SEVERITY_META,
  TASK_TYPES,
  TYPE_META,
  type Workflow,
} from '@msr/shared/enums';
import { MODULE_META } from '@msr/shared/modules';
import type { ProjectDetail } from '@msr/shared/types';
import { Avatar } from '../../components/ui/Avatar';
import type { PickerOption } from '../../components/ui/OptionPicker';
import { PriorityIcon, TypeIcon } from './taskMeta';

export const UNASSIGNED = 'none';

const tone = (value: string) => `var(--tone-${value})`;

export const useTaskOptions = (
  project: Pick<ProjectDetail, 'statuses' | 'labels' | 'memberList'> & Partial<Pick<ProjectDetail, 'module'>>,
) =>
  useMemo(() => {
    const status = (workflow?: Workflow): PickerOption[] =>
      project.statuses
        .filter((item) => !workflow || item.workflow === workflow)
        .map((item) => ({
          value: item.id,
          label: item.name,
          color: item.color,
          group: workflow ? undefined : item.workflow === 'bug' ? 'Bugs' : 'Tasks',
        }));
    return {
      status,
      priority: PRIORITIES.map((value) => ({
        value,
        label: PRIORITY_META[value].label,
        icon: <PriorityIcon priority={value} decorative />,
      })),
      type: (project.module ? MODULE_META[project.module].taskTypes : TASK_TYPES).map((value) => ({
        value,
        label: TYPE_META[value].label,
        icon: <TypeIcon type={value} />,
      })),
      severity: SEVERITIES.map((value) => ({
        value,
        label: SEVERITY_META[value].label,
        color: tone(SEVERITY_META[value].tone),
      })),
      reproducibility: REPRODUCIBILITY.map((value) => ({
        value,
        label: REPRODUCIBILITY_META[value].label,
        color: tone(REPRODUCIBILITY_META[value].tone),
      })),
      assignee: project.memberList.map((member) => ({
        value: member.id,
        label: member.name,
        description: member.email,
        keywords: [member.email],
        icon: <Avatar name={member.name} src={member.avatarUrl} size="xs" decorative />,
      })),
      label: project.labels.map((item) => ({ value: item.id, label: item.name, color: item.color })),
    };
  }, [project.statuses, project.labels, project.memberList, project.module]);

export type TaskOptions = ReturnType<typeof useTaskOptions>;
