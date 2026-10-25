import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PreferencesInput, RegisterInput } from '@msr/shared/schemas/auth';
import type { CurrentUser } from '@msr/shared/types';
import { api, ApiError } from '../../lib/api';

export const ME_KEY = ['me'] as const;

const fetchMe = () =>
  api<{ user: CurrentUser }>('/auth/me').then(
    ({ user }) => user,
    (error) => {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    },
  );

export const useMe = () => useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60_000 });

const useSetMe = () => {
  const client = useQueryClient();
  return ({ user }: { user: CurrentUser }) => client.setQueryData(ME_KEY, user);
};

export type LoginResult = { user: CurrentUser } | { twoFactorRequired: true; ticket: string };

const useSignIn = () => {
  const client = useQueryClient();
  return (user: CurrentUser) => {
    client.clear();
    client.setQueryData(ME_KEY, user);
  };
};

export const useLogin = () => {
  const signIn = useSignIn();
  return useMutation({
    mutationFn: (input: LoginInput) => api<LoginResult>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (result) => {
      if ('user' in result) signIn(result.user);
    },
  });
};

export const useLoginTwoFactor = () => {
  const signIn = useSignIn();
  return useMutation({
    mutationFn: (input: { ticket: string; code: string }) =>
      api<{ user: CurrentUser }>('/auth/login/2fa', { method: 'POST', body: input }),
    onSuccess: ({ user }) => signIn(user),
  });
};

export const useRegister = () => {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<{ user: CurrentUser }>('/auth/register', { method: 'POST', body: input }),
    onSuccess: setMe,
  });
};

export const useLogout = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      client.clear();
      client.setQueryData(ME_KEY, null);
    },
  });
};

export const useUpdateMe = () => {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: { name?: string; preferences?: PreferencesInput }) =>
      api<{ user: CurrentUser }>('/me', { method: 'PATCH', body: input }),
    onSuccess: setMe,
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api('/me/password', { method: 'PUT', body: input }),
  });

export const useChangeEmail = () => {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<{ user: CurrentUser }>('/me/email', { method: 'PUT', body: input }),
    onSuccess: setMe,
  });
};

export const useRemoveAvatar = () => {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: () => api<{ user: CurrentUser }>('/me/avatar', { method: 'DELETE' }),
    onSuccess: setMe,
  });
};

export const useResendVerification = () =>
  useMutation({ mutationFn: () => api('/auth/resend-verification', { method: 'POST' }) });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (email: string) => api('/auth/forgot-password', { method: 'POST', body: { email } }),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api('/auth/reset-password', { method: 'POST', body: input }),
  });

export const useVerifyEmail = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api('/auth/verify-email', { method: 'POST', body: { token } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ME_KEY }),
  });
};
