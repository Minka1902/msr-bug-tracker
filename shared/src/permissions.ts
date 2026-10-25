export const PERMISSIONS = {
  'task.create': 1 << 0,
  'task.edit_own': 1 << 1,
  'task.edit_any': 1 << 2,
  'task.transition': 1 << 3,
  'task.assign_self': 1 << 4,
  'task.assign_others': 1 << 5,
  'task.delete': 1 << 6,
  'task.move': 1 << 7,
  'comment.create': 1 << 8,
  'comment.moderate': 1 << 9,
  'attachment.upload': 1 << 10,
  'attachment.delete_any': 1 << 11,
  'project.edit': 1 << 12,
  'project.manage_workflow': 1 << 13,
  'project.manage_labels': 1 << 14,
  'project.manage_members': 1 << 15,
  'project.manage_roles': 1 << 16,
  'project.archive': 1 << 17,
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).reduce((mask, bit) => mask | bit, 0);

export const SYSTEM_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const PERMISSION_GROUPS: { label: string; items: { key: Permission; label: string; description: string }[] }[] = [
  {
    label: 'Tasks',
    items: [
      { key: 'task.create', label: 'Create tasks', description: 'Create tasks, bugs and subtasks' },
      { key: 'task.edit_own', label: 'Edit own tasks', description: 'Edit tasks they reported or are assigned to' },
      { key: 'task.edit_any', label: 'Edit any task', description: 'Edit every task in the project' },
      { key: 'task.transition', label: 'Change status', description: 'Move tasks between statuses' },
      { key: 'task.assign_self', label: 'Assign to self', description: 'Take or drop tasks for themselves' },
      { key: 'task.assign_others', label: 'Assign others', description: 'Assign tasks to any member' },
      { key: 'task.delete', label: 'Delete tasks', description: 'Permanently delete tasks' },
      { key: 'task.move', label: 'Move tasks', description: 'Move tasks to another project' },
    ],
  },
  {
    label: 'Comments & files',
    items: [
      { key: 'comment.create', label: 'Comment', description: 'Write comments and replies' },
      { key: 'comment.moderate', label: 'Moderate comments', description: "Edit or delete others' comments" },
      { key: 'attachment.upload', label: 'Upload files', description: 'Attach screenshots and files' },
      { key: 'attachment.delete_any', label: 'Delete any file', description: "Delete others' attachments" },
    ],
  },
  {
    label: 'Project',
    items: [
      { key: 'project.edit', label: 'Edit project', description: 'Name, description, color and icon' },
      { key: 'project.manage_workflow', label: 'Manage workflows', description: 'Add, edit and reorder statuses' },
      { key: 'project.manage_labels', label: 'Manage labels', description: 'Create, edit and delete labels' },
      { key: 'project.manage_members', label: 'Manage members', description: 'Add, remove and change roles' },
      { key: 'project.manage_roles', label: 'Manage roles', description: 'Create and edit roles' },
      { key: 'project.archive', label: 'Archive project', description: 'Archive and restore the project' },
    ],
  },
];

export const maskOf = (...keys: Permission[]) => keys.reduce((mask, key) => mask | PERMISSIONS[key], 0);

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, number> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  member: maskOf(
    'task.create',
    'task.edit_own',
    'task.edit_any',
    'task.transition',
    'task.assign_self',
    'task.assign_others',
    'comment.create',
    'attachment.upload',
    'project.manage_labels',
  ),
  viewer: 0,
};

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export const can = (mask: number, key: Permission) => (mask & PERMISSIONS[key]) !== 0;

export const isSubsetOf = (mask: number, of: number) => (mask & ~of) === 0;

export const listPermissions = (mask: number) =>
  (Object.keys(PERMISSIONS) as Permission[]).filter((key) => can(mask, key));

export interface TaskOwnership {
  reporterId: string | null;
  assigneeId: string | null;
}

export const isOwnTask = (task: TaskOwnership, userId: string) =>
  task.reporterId === userId || task.assigneeId === userId;

export const canEditTask = (mask: number, task: TaskOwnership, userId: string) =>
  can(mask, 'task.edit_any') || (can(mask, 'task.edit_own') && isOwnTask(task, userId));

export const assignmentPermission = (
  currentAssigneeId: string | null,
  nextAssigneeId: string | null,
  userId: string,
): Permission =>
  (nextAssigneeId !== null && nextAssigneeId !== userId) || (currentAssigneeId !== null && currentAssigneeId !== userId)
    ? 'task.assign_others'
    : 'task.assign_self';

export const canAssign = (mask: number, currentAssigneeId: string | null, nextAssigneeId: string | null, userId: string) => {
  const needed = assignmentPermission(currentAssigneeId, nextAssigneeId, userId);
  return can(mask, needed) || (needed === 'task.assign_self' && can(mask, 'task.assign_others'));
};

const TRANSITION_FIELDS = new Set(['statusId', 'statusCategory', 'position']);

export const missingTaskPermissions = (
  mask: number,
  task: TaskOwnership,
  patch: Record<string, unknown>,
  userId: string,
): Permission[] => {
  const missing = new Set<Permission>();
  for (const field of Object.keys(patch)) {
    if (field === 'assigneeId') {
      const next = (patch[field] as string | null | undefined) ?? null;
      if (!canAssign(mask, task.assigneeId, next, userId)) missing.add(assignmentPermission(task.assigneeId, next, userId));
    } else if (TRANSITION_FIELDS.has(field)) {
      if (!can(mask, 'task.transition')) missing.add('task.transition');
    } else if (!canEditTask(mask, task, userId)) {
      missing.add(isOwnTask(task, userId) ? 'task.edit_own' : 'task.edit_any');
    }
  }
  return [...missing];
};
