import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProjectInput } from '@msr/shared/schemas/project';
import type { StatusCategory } from '@msr/shared/enums';
import { api } from '../../lib/api';
import { projectKeys } from '../projects/api';
import { taskKeys } from '../tasks/api';

export interface SourceOption {
  id: string;
  name: string;
  group: string | null;
}

export interface MigrationJob {
  id: string;
  tool: string;
  status: 'fetching' | 'ready' | 'importing' | 'done' | 'failed';
  progress: { message: string; done: number; total: number | null };
  error: string | null;
  sourceName: string | null;
  total: number;
  statuses: { name: string; category: StatusCategory; count: number }[];
  people: { key: string; name: string | null; email: string | null; count: number }[];
  result: { projectKey: string; created: number; skipped: number; warnings: string[] } | null;
}

export interface CommitInput {
  target: { projectKey: string } | { project: CreateProjectInput };
  statusMap: Record<string, string>;
  memberMap: Record<string, string | null>;
}

const POLLING = new Set(['fetching', 'importing']);

export const useMigrationSources = (tool: string) =>
  useMutation({
    mutationFn: (credentials: Record<string, string>) =>
      api<{ sources: SourceOption[] }>(`/migrations/${tool}/sources`, {
        method: 'POST',
        body: { credentials },
      }).then((data) => data.sources),
  });

export const useStartMigration = (tool: string) =>
  useMutation({
    mutationFn: (input: {
      credentials: Record<string, string>;
      sourceId: string;
      includeComments: boolean;
      includeClosed: boolean;
    }) =>
      api<{ job: MigrationJob }>(`/migrations/${tool}/jobs`, { method: 'POST', body: input }).then(
        (data) => data.job,
      ),
  });

export const useMigrationJob = (id: string | null) => {
  const client = useQueryClient();
  return useQuery({
    queryKey: ['migration-job', id],
    queryFn: async () => {
      const { job } = await api<{ job: MigrationJob }>(`/migrations/jobs/${id}`);
      if (job.status === 'done')
        await Promise.all([
          client.invalidateQueries({ queryKey: projectKeys.all }),
          client.invalidateQueries({ queryKey: taskKeys.all }),
        ]);
      return job;
    },
    enabled: !!id,
    refetchInterval: (query) => (POLLING.has(query.state.data?.status ?? 'fetching') ? 1000 : false),
  });
};

export const useCommitMigration = (id: string | null) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CommitInput) =>
      api<{ job: MigrationJob }>(`/migrations/jobs/${id}/commit`, { method: 'POST', body: input }).then(
        (data) => data.job,
      ),
    onSuccess: (job) => client.setQueryData(['migration-job', id], job),
  });
};

export const useDiscardMigration = () =>
  useMutation({ mutationFn: (id: string) => api(`/migrations/jobs/${id}`, { method: 'DELETE' }) });
