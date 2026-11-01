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
  type TaskType,
  type Workflow,
} from '@msr/shared/enums';
import { MODULE_META } from '@msr/shared/modules';
import { cardTypeAllows } from '@msr/shared/permissions';
import type { ProjectDetail } from '@msr/shared/types';
import { Avatar } from '../../components/ui/Avatar';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { PickerOption } from '../../components/ui/OptionPicker';
import { PriorityIcon, TypeIcon } from './taskMeta';

export const UNASSIGNED = 'none';

const tone = (value: string) => `var(--tone-${value})`;

type OptionsProject = Pick<ProjectDetail, 'statuses' | 'labels' | 'memberList'> &
  Partial<Pick<ProjectDetail, 'module' | 'cardTypes' | 'isOwner'>>;

export const useTaskOptions = (project: OptionsProject) => {
  const user = useCurrentUser();

  return useMemo(() => {
    const cardTypes = project.cardTypes ?? [];
    const roleId = project.memberList.find((member) => member.id === user.id)?.roleId ?? '';
    const builtIn = project.module ? MODULE_META[project.module].taskTypes : TASK_TYPES;
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
      type: [
        ...builtIn.map((value): PickerOption => ({
          value: value as string,
          label: TYPE_META[value].label,
          icon: <TypeIcon type={value} />,
        })),
        ...cardTypes.map((cardType) => {
          const allowed = cardTypeAllows(cardType.createRoleIds, roleId, !!project.isOwner);
          return {
            value: cardType.id,
            label: cardType.name,
            icon: <TypeIcon type={cardType.base} cardType={cardType} />,
            description: allowed
              ? `Works like ${TYPE_META[cardType.base].label}`
              : "Your role can't create these",
            disabled: !allowed,
          };
        }),
      ],
      typeBase: (value: string): TaskType =>
        cardTypes.find((cardType) => cardType.id === value)?.base ?? (value as TaskType),
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
        description: member.isAgent ? 'AI worker' : member.email,
        keywords: [member.isAgent ? 'ai worker' : member.email],
        icon: <Avatar name={member.name} src={member.avatarUrl} size="xs" bot={member.isAgent} decorative />,
      })),
      label: project.labels.map((item) => ({ value: item.id, label: item.name, color: item.color })),
    };
  }, [
    project.statuses,
    project.labels,
    project.memberList,
    project.module,
    project.cardTypes,
    project.isOwner,
    user.id,
  ]);
};

export type TaskOptions = ReturnType<typeof useTaskOptions>;
