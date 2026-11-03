import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BotPlatform } from '@msr/shared/bots';
import type { UpdateBotChatInput } from '@msr/shared/schemas/bots';
import type { BotChat, BotLink, BotSettings } from '@msr/shared/types';
import { api } from '../../lib/api';

interface ChatTarget {
  platform: BotPlatform;
  chatId: string;
}

export const botKeys = {
  all: ['bots'] as const,
  project: (projectKey: string) => ['bots', projectKey] as const,
};

const chatPath = (projectKey: string, { platform, chatId }: ChatTarget) =>
  `/projects/${projectKey}/bots/chats/${platform}/${chatId}`;

const useRefresh = (projectKey?: string) => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: projectKey ? botKeys.project(projectKey) : botKeys.all });
};

export const useBotSettings = (projectKey: string, enabled = true) =>
  useQuery({
    queryKey: botKeys.project(projectKey),
    queryFn: () => api<BotSettings>(`/projects/${projectKey}/bots`),
    enabled,
  });

export const useBotLink = (projectKey: string) =>
  useMutation({
    mutationFn: (body: { platform: BotPlatform; target: 'private' | 'group' }) =>
      api<BotLink>(`/projects/${projectKey}/bots/link`, { method: 'POST', body }),
  });

export const useUpdateBotChat = (projectKey: string) => {
  const client = useQueryClient();
  const refresh = useRefresh(projectKey);
  return useMutation({
    mutationFn: ({ patch, ...chat }: ChatTarget & { patch: UpdateBotChatInput }) =>
      api<{ chat: BotChat }>(chatPath(projectKey, chat), { method: 'PATCH', body: patch }),
    onMutate: ({ platform, chatId, patch }) =>
      client.setQueryData<BotSettings>(
        botKeys.project(projectKey),
        (settings) =>
          settings && {
            ...settings,
            chats: settings.chats.map((chat) =>
              chat.platform === platform && chat.chatId === chatId ? { ...chat, ...patch } : chat,
            ),
          },
      ),
    onSettled: refresh,
  });
};

export const useUnlinkBotChat = (projectKey: string) => {
  const refresh = useRefresh(projectKey);
  return useMutation({
    mutationFn: (chat: ChatTarget) => api(chatPath(projectKey, chat), { method: 'DELETE' }),
    onSuccess: refresh,
  });
};

export const useDisconnectBot = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (platform: BotPlatform) => api(`/me/bots/${platform}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
};
