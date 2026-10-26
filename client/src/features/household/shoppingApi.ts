import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateItemInput, UpdateItemInput } from '@msr/shared/schemas/shopping';
import type { ShoppingList } from '@msr/shared/types';
import { api } from '../../lib/api';

const REFRESH_MS = 10_000;

export const shoppingKeys = {
  lists: (projectKey: string) => ['shopping', projectKey.toUpperCase()] as const,
};

const listsPath = (projectKey: string) => `/projects/${projectKey}/lists`;

export const useShoppingLists = (projectKey: string, live = true) =>
  useQuery({
    queryKey: shoppingKeys.lists(projectKey),
    queryFn: () => api<{ lists: ShoppingList[] }>(listsPath(projectKey)).then((data) => data.lists),
    refetchInterval: live ? REFRESH_MS : false,
  });

const useListMutation = <TInput>(
  projectKey: string,
  request: (input: TInput) => Promise<ShoppingList | null>,
  optimistic?: (lists: ShoppingList[], input: TInput) => ShoppingList[],
) => {
  const client = useQueryClient();
  const key = shoppingKeys.lists(projectKey);
  return useMutation({
    mutationFn: request,
    onMutate: async (input) => {
      if (!optimistic) return;
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<ShoppingList[]>(key, (lists) => lists && optimistic(lists, input));
    },
    onSuccess: (list) =>
      list &&
      client.setQueryData<ShoppingList[]>(key, (lists) =>
        lists?.some((item) => item.id === list.id)
          ? lists.map((item) => (item.id === list.id ? list : item))
          : [...(lists ?? []), list],
      ),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
};

const listOf = (request: Promise<{ list: ShoppingList }>) => request.then((data) => data.list);

export const useCreateList = (projectKey: string) =>
  useListMutation(projectKey, (name: string) =>
    listOf(api(listsPath(projectKey), { method: 'POST', body: { name } })),
  );

export const useRenameList = (projectKey: string) =>
  useListMutation(projectKey, ({ listId, name }: { listId: string; name: string }) =>
    listOf(api(`${listsPath(projectKey)}/${listId}`, { method: 'PATCH', body: { name } })),
  );

export const useDeleteList = (projectKey: string) =>
  useListMutation(
    projectKey,
    (listId: string) => api(`${listsPath(projectKey)}/${listId}`, { method: 'DELETE' }).then(() => null),
    (lists, listId) => lists.filter((list) => list.id !== listId),
  );

export const useAddItem = (projectKey: string) =>
  useListMutation(projectKey, ({ listId, ...body }: CreateItemInput & { listId: string }) =>
    listOf(api(`${listsPath(projectKey)}/${listId}/items`, { method: 'POST', body })),
  );

export const useUpdateItem = (projectKey: string) =>
  useListMutation(
    projectKey,
    ({ listId, itemId, patch }: { listId: string; itemId: string; patch: UpdateItemInput }) =>
      listOf(api(`${listsPath(projectKey)}/${listId}/items/${itemId}`, { method: 'PATCH', body: patch })),
    (lists, { listId, itemId, patch }) =>
      lists.map((list) =>
        list.id === listId
          ? { ...list, items: list.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }
          : list,
      ),
  );

export const useRemoveItem = (projectKey: string) =>
  useListMutation(
    projectKey,
    ({ listId, itemId }: { listId: string; itemId: string }) =>
      listOf(api(`${listsPath(projectKey)}/${listId}/items/${itemId}`, { method: 'DELETE' })),
    (lists, { listId, itemId }) =>
      lists.map((list) =>
        list.id === listId ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list,
      ),
  );

export const useClearChecked = (projectKey: string) =>
  useListMutation(projectKey, (listId: string) =>
    listOf(api(`${listsPath(projectKey)}/${listId}/clear-checked`, { method: 'POST' })),
  );
