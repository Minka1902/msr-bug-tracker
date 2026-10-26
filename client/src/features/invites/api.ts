import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatedInvite, InvitePreview, InviteSummary } from '@msr/shared/types';
import { api } from '../../lib/api';

export interface InviteInput {
  projectKey?: string;
  roleId?: string;
  email?: string;
  maxUses: number | null;
  expiresInDays?: number;
}

const invitesKey = (projectKey: string) => ['invites', projectKey] as const;

export const useProjectInvites = (projectKey: string, enabled = true) =>
  useQuery({
    queryKey: invitesKey(projectKey),
    queryFn: () =>
      api<{ invites: InviteSummary[] }>(`/projects/${projectKey}/invites`).then((data) => data.invites),
    enabled,
  });

export const useCreateInvite = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, ...input }: InviteInput) =>
      api<{ invite: CreatedInvite }>(projectKey ? `/projects/${projectKey}/invites` : '/invites', {
        method: 'POST',
        body: input,
      }).then((data) => data.invite),
    onSuccess: (_invite, { projectKey }) =>
      projectKey && client.invalidateQueries({ queryKey: invitesKey(projectKey) }),
  });
};

export const useRevokeInvite = (projectKey: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/projects/${projectKey}/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: invitesKey(projectKey) }),
  });
};

export const useInvitePreview = (token: string) =>
  useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => api<{ invite: InvitePreview }>(`/auth/invites/${token}`).then((data) => data.invite),
    retry: false,
  });

export const useAcceptInvite = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ projectKey: string | null; joined: boolean }>(`/invites/${token}/accept`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' }),
  });
};
