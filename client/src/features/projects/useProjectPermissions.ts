import {
  can,
  canAssign,
  canEditTask,
  cardTypeAllows,
  canTransitionTask,
  type Permission,
  type TaskOwnership,
} from '@msr/shared/permissions';
import type { ProjectDetail, ProjectSummary } from '@msr/shared/types';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface CardOwnership extends Pick<TaskOwnership, 'assigneeId'> {
  cardTypeId?: string | null;
}

export const useProjectPermissions = (
  project:
    | (Pick<ProjectSummary, 'permissions' | 'isArchived' | 'roleName' | 'isOwner'> &
        Partial<Pick<ProjectDetail, 'cardTypes' | 'memberList'>>)
    | undefined,
) => {
  const cardTypeEditable = (task: CardOwnership) => {
    const editRoleIds = project?.cardTypes?.find((cardType) => cardType.id === task.cardTypeId)?.editRoleIds;
    const roleId = project?.memberList?.find((member) => member.id === user.id)?.roleId ?? '';
    return !editRoleIds || cardTypeAllows(editRoleIds, roleId, !!project?.isOwner);
  };

  const user = useCurrentUser();
  const mask = project && !project.isArchived ? project.permissions : 0;

  return {
    can: (permission: Permission) => can(mask, permission),
    canEditTask: (task: CardOwnership & TaskOwnership) =>
      canEditTask(mask, task, user.id) && cardTypeEditable(task),
    canTransition: (task: CardOwnership) => canTransitionTask(mask, task, user.id) && cardTypeEditable(task),
    canAssign: (current: string | null, next: string | null) => canAssign(mask, current, next, user.id),
    isOwner: !!project?.isOwner,
    deniedReason: project?.isArchived
      ? 'This project is archived'
      : `Your role (${project?.roleName ?? 'none'}) can't do that`,
  };
};
