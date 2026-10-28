import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CurrentUser } from '@msr/shared/types';
import { api } from '../../lib/api';
import { ME_KEY } from '../auth/api';

export interface DemoStatus {
  exists: boolean;
  seed: number | null;
  size: 'small' | 'large' | null;
  generatedAt: string | null;
  counts: { projects: number; tasks: number };
  teammates: { id: string; name: string; email: string; roleName: string }[];
}

const DEMO_KEY = ['demo'] as const;

export const useAppConfig = () =>
  useQuery({
    queryKey: ['config'],
    queryFn: () =>
      api<{ features: { demoData: boolean; googleCalendar: boolean; telegram: boolean } }>('/config'),
    staleTime: Infinity,
  });

export const useDemoStatus = (enabled = true) =>
  useQuery({
    queryKey: DEMO_KEY,
    queryFn: () => api<{ status: DemoStatus }>('/demo').then((data) => data.status),
    enabled,
  });

const useResetAll = () => {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== 'config' && query.queryKey[0] !== 'me',
    });
};

export const useGenerateDemo = () => {
  const reset = useResetAll();
  return useMutation({
    mutationFn: (input: { size: 'small' | 'large'; seed?: number }) =>
      api<{ status: DemoStatus }>('/demo', { method: 'POST', body: input }),
    onSuccess: reset,
  });
};

export const useRemoveDemo = () => {
  const reset = useResetAll();
  return useMutation({ mutationFn: () => api('/demo', { method: 'DELETE' }), onSuccess: reset });
};

const useSwitchUser = (request: (userId?: string) => Promise<{ user: CurrentUser }>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: ({ user }) => {
      client.clear();
      client.setQueryData(ME_KEY, user);
    },
  });
};

export const useImpersonate = () =>
  useSwitchUser((userId) => api<{ user: CurrentUser }>(`/demo/impersonate/${userId}`, { method: 'POST' }));

export const useStopImpersonating = () =>
  useSwitchUser(() => api<{ user: CurrentUser }>('/demo/impersonate/stop', { method: 'POST' }));
