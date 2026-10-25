import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProjectInput, UpdateProjectInput } from '@msr/shared/schemas/project';
import type {
  Label,
  ProjectDetail,
  ProjectMember,
  ProjectRole,
  ProjectStatus,
  ProjectSummary,
} from '@msr/shared/types';
import type { StatusCategory, Workflow } from '@msr/shared/enums';
import { api } from '../../lib/api';

export type ArchivedFilter = 'false' | 'true' | 'all';

export const projectKeys = {
  all: ['projects'] as const,
  list: (archived: ArchivedFilter) => ['projects', 'list', archived] as const,
  detail: (key: string) => ['projects', 'detail', key.toUpperCase()] as const,
};

export const useProjects = (archived: ArchivedFilter = 'false') =>
  useQuery({
    queryKey: projectKeys.list(archived),
    queryFn: () =>
      api<{ projects: ProjectSummary[] }>('/projects', { query: { archived } }).then((data) => data.projects),
  });

export const useProject = (key: string) =>
  useQuery({
    queryKey: projectKeys.detail(key),
    queryFn: () => api<{ project: ProjectDetail }>(`/projects/${key}`).then((data) => data.project),
  });

export const useKeyAvailability = (key: string, enabled: boolean) =>
  useQuery({
    queryKey: ['projects', 'key', key],
    queryFn: () =>
      api<{ key: string; available: boolean; suggestion: string | null }>('/projects/key-available', {
        query: { key },
      }),
    enabled,
    staleTime: 10_000,
  });

const useInvalidateProjects = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: projectKeys.all });
};

export const useCreateProject = () => {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api<{ project: ProjectDetail }>('/projects', { method: 'POST', body: input }).then(
        (data) => data.project,
      ),
    onSuccess: invalidate,
  });
};

const useProjectMutation = <TInput, TResult = unknown>(request: (input: TInput) => Promise<TResult>) => {
  const invalidate = useInvalidateProjects();
  return useMutation({ mutationFn: request, onSuccess: invalidate });
};

export const useUpdateProject = (key: string) =>
  useProjectMutation((input: UpdateProjectInput) =>
    api(`/projects/${key}`, { method: 'PATCH', body: input }),
  );

export const useArchiveProject = (key: string) =>
  useProjectMutation((archived: boolean) =>
    api(`/projects/${key}/${archived ? 'archive' : 'restore'}`, { method: 'POST' }),
  );

export const useDeleteProject = (key: string) =>
  useProjectMutation(() => api(`/projects/${key}`, { method: 'DELETE' }));

export const useToggleFavorite = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ key, favorite }: { key: string; favorite: boolean }) =>
      api(`/projects/${key}/favorite`, { method: 'PUT', body: { favorite } }),
    onMutate: async ({ key, favorite }) => {
      await client.cancelQueries({ queryKey: projectKeys.all });
      client.setQueriesData<ProjectSummary[]>({ queryKey: ['projects', 'list'] }, (projects) =>
        projects?.map((project) => (project.key === key ? { ...project, isFavorite: favorite } : project)),
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
};

export const useCreateStatus = (key: string) =>
  useProjectMutation((input: { workflow: Workflow; name: string; color: string; category: StatusCategory }) =>
    api<{ status: ProjectStatus }>(`/projects/${key}/statuses`, { method: 'POST', body: input }),
  );

export const useUpdateStatus = (key: string) =>
  useProjectMutation(
    ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      color?: string;
      category?: StatusCategory;
      position?: string;
    }) => api(`/projects/${key}/statuses/${id}`, { method: 'PATCH', body: input }),
  );

export const useDeleteStatus = (key: string) =>
  useProjectMutation(({ id, moveTo }: { id: string; moveTo: string }) =>
    api(`/projects/${key}/statuses/${id}`, { method: 'DELETE', body: { moveTo } }),
  );

export const useCreateLabel = (key: string) =>
  useProjectMutation((input: { name: string; color: string }) =>
    api<{ label: Label }>(`/projects/${key}/labels`, { method: 'POST', body: input }).then(
      (data) => data.label,
    ),
  );

export const useUpdateLabel = (key: string) =>
  useProjectMutation(({ id, ...input }: { id: string; name?: string; color?: string }) =>
    api(`/projects/${key}/labels/${id}`, { method: 'PATCH', body: input }),
  );

export const useDeleteLabel = (key: string) =>
  useProjectMutation((id: string) => api(`/projects/${key}/labels/${id}`, { method: 'DELETE' }));

export const useCreateRole = (key: string) =>
  useProjectMutation((input: { name: string; permissions: number }) =>
    api<{ role: ProjectRole }>(`/projects/${key}/roles`, { method: 'POST', body: input }),
  );

export const useUpdateRole = (key: string) =>
  useProjectMutation(({ id, ...input }: { id: string; name?: string; permissions?: number }) =>
    api(`/projects/${key}/roles/${id}`, { method: 'PATCH', body: input }),
  );

export const useDeleteRole = (key: string) =>
  useProjectMutation(({ id, reassignToRoleId }: { id: string; reassignToRoleId: string }) =>
    api(`/projects/${key}/roles/${id}`, { method: 'DELETE', body: { reassignToRoleId } }),
  );

export const useAddMember = (key: string) =>
  useProjectMutation((input: { email: string; roleId: string }) =>
    api<{ member: ProjectMember }>(`/projects/${key}/members`, { method: 'POST', body: input }),
  );

export const useChangeMemberRole = (key: string) =>
  useProjectMutation(({ userId, roleId }: { userId: string; roleId: string }) =>
    api(`/projects/${key}/members/${userId}`, { method: 'PATCH', body: { roleId } }),
  );

export const useRemoveMember = (key: string) =>
  useProjectMutation((userId: string) => api(`/projects/${key}/members/${userId}`, { method: 'DELETE' }));
