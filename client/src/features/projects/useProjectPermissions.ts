import { can, canAssign, canEditTask, type Permission, type TaskOwnership } from '@msr/shared/permissions';
import type { ProjectSummary } from '@msr/shared/types';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export const useProjectPermissions = (
  project: Pick<ProjectSummary, 'permissions' | 'isArchived' | 'roleName' | 'isOwner'> | undefined,
) => {
  const user = useCurrentUser();
  const mask = project && !project.isArchived ? project.permissions : 0;

  return {
    can: (permission: Permission) => can(mask, permission),
    canEditTask: (task: TaskOwnership) => canEditTask(mask, task, user.id),
    canAssign: (current: string | null, next: string | null) => canAssign(mask, current, next, user.id),
    isOwner: !!project?.isOwner,
    deniedReason: project?.isArchived
      ? 'This project is archived'
      : `Your role (${project?.roleName ?? 'none'}) can't do that`,
  };
};
