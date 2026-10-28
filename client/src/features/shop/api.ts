import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaidTier } from '@msr/shared/modules';
import type { PackInput } from '@msr/shared/schemas/shop';
import type { ShopState } from '@msr/shared/types';
import { api } from '../../lib/api';

const SHOP_KEY = ['shop'] as const;

const useStoreShop = () => {
  const client = useQueryClient();
  return (state: ShopState) => client.setQueryData(SHOP_KEY, state);
};

export const useShop = () => useQuery({ queryKey: SHOP_KEY, queryFn: () => api<ShopState>('/shop') });

export const useSubscribe = () => {
  const store = useStoreShop();
  return useMutation({
    mutationFn: (tier: PaidTier) => api<ShopState>('/shop/subscribe', { method: 'POST', body: { tier } }),
    onSuccess: store,
  });
};

export const useBuyPack = () => {
  const store = useStoreShop();
  return useMutation({
    mutationFn: (input: PackInput) => api<ShopState>('/shop/packs', { method: 'POST', body: input }),
    onSuccess: store,
  });
};

export const useRefreshShop = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: SHOP_KEY });
};
