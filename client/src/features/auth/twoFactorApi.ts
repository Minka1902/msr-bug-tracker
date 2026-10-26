import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CurrentUser } from '@msr/shared/types';
import { api } from '../../lib/api';
import { ME_KEY } from './api';

const TWO_FACTOR_KEY = ['two-factor'] as const;

const useRefresh = () => {
  const client = useQueryClient();
  return (user?: CurrentUser) => {
    if (user) client.setQueryData(ME_KEY, user);
    return client.invalidateQueries({ queryKey: TWO_FACTOR_KEY });
  };
};

export const useTwoFactorStatus = () =>
  useQuery({
    queryKey: TWO_FACTOR_KEY,
    queryFn: () => api<{ enabled: boolean; recoveryCodesLeft: number }>('/me/2fa'),
  });

export const useStartTwoFactor = () =>
  useMutation({
    mutationFn: (password: string) =>
      api<{ secret: string; otpauthUrl: string }>('/me/2fa/setup', { method: 'POST', body: { password } }),
  });

export const useEnableTwoFactor = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (code: string) =>
      api<{ recoveryCodes: string[]; user: CurrentUser }>('/me/2fa/enable', {
        method: 'POST',
        body: { code },
      }),
    onSuccess: ({ user }) => refresh(user),
  });
};

export const useRegenerateRecoveryCodes = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { code: string }) =>
      api<{ recoveryCodes: string[] }>('/me/2fa/recovery-codes', { method: 'POST', body: input }),
    onSuccess: () => refresh(),
  });
};

export const useDisableTwoFactor = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { password: string; code: string }) =>
      api<{ user: CurrentUser }>('/me/2fa/disable', { method: 'POST', body: input }),
    onSuccess: ({ user }) => refresh(user),
  });
};
