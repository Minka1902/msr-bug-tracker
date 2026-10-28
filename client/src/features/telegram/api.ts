import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateTelegramChatInput } from '@msr/shared/schemas/telegram';
import type { TelegramChat, TelegramSettings } from '@msr/shared/types';
import { api } from '../../lib/api';

export const telegramKeys = {
  all: ['telegram'] as const,
  project: (projectKey: string) => ['telegram', projectKey] as const,
};

const useRefresh = (projectKey?: string) => {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({ queryKey: projectKey ? telegramKeys.project(projectKey) : telegramKeys.all });
};

export const useTelegramSettings = (projectKey: string, enabled = true) =>
  useQuery({
    queryKey: telegramKeys.project(projectKey),
    queryFn: () => api<TelegramSettings>(`/projects/${projectKey}/telegram`),
    enabled,
  });

export const useTelegramLink = (projectKey: string) =>
  useMutation({
    mutationFn: (target: 'private' | 'group') =>
      api<{ url: string }>(`/projects/${projectKey}/telegram/link`, { method: 'POST', body: { target } }),
  });

export const useUpdateTelegramChat = (projectKey: string) => {
  const client = useQueryClient();
  const refresh = useRefresh(projectKey);
  return useMutation({
    mutationFn: ({ chatId, patch }: { chatId: number; patch: UpdateTelegramChatInput }) =>
      api<{ chat: TelegramChat }>(`/projects/${projectKey}/telegram/chats/${chatId}`, {
        method: 'PATCH',
        body: patch,
      }),
    onMutate: ({ chatId, patch }) =>
      client.setQueryData<TelegramSettings>(
        telegramKeys.project(projectKey),
        (settings) =>
          settings && {
            ...settings,
            chats: settings.chats.map((chat) => (chat.chatId === chatId ? { ...chat, ...patch } : chat)),
          },
      ),
    onSettled: refresh,
  });
};

export const useUnlinkTelegramChat = (projectKey: string) => {
  const refresh = useRefresh(projectKey);
  return useMutation({
    mutationFn: (chatId: number) =>
      api(`/projects/${projectKey}/telegram/chats/${chatId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
};

export const useDisconnectTelegram = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: () => api('/me/telegram', { method: 'DELETE' }),
    onSuccess: refresh,
  });
};
