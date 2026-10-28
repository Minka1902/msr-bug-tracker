import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiWorker, ProjectMember } from '@msr/shared/types';
import { api } from '../../lib/api';
import { projectKeys } from '../projects/api';

const WORKERS_KEY = ['ai-workers'] as const;
const CONNECTED_APPS_KEY = ['connected-apps'] as const;

const useRefresh = () => {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: WORKERS_KEY }),
      client.invalidateQueries({ queryKey: CONNECTED_APPS_KEY }),
      client.invalidateQueries({ queryKey: projectKeys.all }),
    ]);
};

export const useWorkers = () =>
  useQuery({
    queryKey: WORKERS_KEY,
    queryFn: () => api<{ workers: AiWorker[] }>('/me/agents').then((data) => data.workers),
  });

export const useCreateWorker = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { grantId: string; name: string }) =>
      api<{ workers: AiWorker[] }>('/me/agents', { method: 'POST', body: input }),
    onSuccess: refresh,
  });
};

export const useUpdateWorker = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; grantId?: string }) =>
      api<{ workers: AiWorker[] }>(`/me/agents/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: refresh,
  });
};

export const useDeleteWorker = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api(`/me/agents/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
};

export const useAddWorkerToProject = (projectKey: string) => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { agentId: string; roleId: string }) =>
      api<{ member: ProjectMember }>(`/projects/${projectKey}/members/agents`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: refresh,
  });
};
