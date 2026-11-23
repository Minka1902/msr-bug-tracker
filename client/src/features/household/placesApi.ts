import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePlaceInput, UpdatePlaceInput } from '@msr/shared/schemas/place';
import type { Place } from '@msr/shared/types';
import { api } from '../../lib/api';

export const placeKeys = {
  all: (projectKey: string) => ['places', projectKey.toUpperCase()] as const,
};

const placesPath = (projectKey: string) => `/projects/${projectKey}/places`;

export type SavePlaceInput =
  { id: string; input: UpdatePlaceInput } | { id?: undefined; input: CreatePlaceInput };

export const usePlaces = (projectKey: string) =>
  useQuery({
    queryKey: placeKeys.all(projectKey),
    queryFn: () => api<{ places: Place[] }>(placesPath(projectKey)).then((data) => data.places),
  });

export const useSavePlace = (projectKey: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: SavePlaceInput) =>
      api<{ place: Place }>(id ? `${placesPath(projectKey)}/${id}` : placesPath(projectKey), {
        method: id ? 'PATCH' : 'POST',
        body: input,
      }).then((data) => data.place),
    onSettled: () => client.invalidateQueries({ queryKey: placeKeys.all(projectKey) }),
  });
};

export const useDeletePlace = (projectKey: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${placesPath(projectKey)}/${id}`, { method: 'DELETE' }),
    onSettled: () => client.invalidateQueries({ queryKey: placeKeys.all(projectKey) }),
  });
};
