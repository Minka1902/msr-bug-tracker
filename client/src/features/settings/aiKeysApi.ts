import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiProvider } from '@msr/shared/enums';
import { api } from '../../lib/api';

export interface SavedAiKey {
  provider: AiProvider;
  last4: string;
  verifiedAt: string;
}

const AI_KEYS_KEY = ['ai-keys'] as const;

const useStoreKeys = () => {
  const client = useQueryClient();
  return ({ keys }: { keys: SavedAiKey[] }) => client.setQueryData(AI_KEYS_KEY, keys);
};

export const useAiKeys = () =>
  useQuery({
    queryKey: AI_KEYS_KEY,
    queryFn: () => api<{ keys: SavedAiKey[] }>('/me/ai-keys').then((data) => data.keys),
  });

export const useSaveAiKey = () => {
  const store = useStoreKeys();
  return useMutation({
    mutationFn: ({ provider, key }: { provider: AiProvider; key: string }) =>
      api<{ keys: SavedAiKey[] }>(`/me/ai-keys/${provider}`, { method: 'PUT', body: { key } }),
    onSuccess: store,
  });
};

export const useRemoveAiKey = () => {
  const store = useStoreKeys();
  return useMutation({
    mutationFn: (provider: AiProvider) =>
      api<{ keys: SavedAiKey[] }>(`/me/ai-keys/${provider}`, { method: 'DELETE' }),
    onSuccess: store,
  });
};
