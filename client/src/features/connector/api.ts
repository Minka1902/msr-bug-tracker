import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConnectorScope } from '@msr/shared/enums';
import type { ConnectedApp, ConnectorRequestPreview } from '@msr/shared/types';
import { api } from '../../lib/api';

export interface ConnectorDecision {
  request: string;
  approve: boolean;
  scopes?: ConnectorScope[];
}

const CONNECTED_APPS_KEY = ['connected-apps'] as const;

export const mcpUrl = () => `${location.origin}/mcp`;

export const useConnectorRequest = (request: string, enabled: boolean) =>
  useQuery({
    queryKey: ['connector-request', request],
    queryFn: () =>
      api<{ request: ConnectorRequestPreview }>('/connector/request', { query: { request } }).then(
        (data) => data.request,
      ),
    enabled: enabled && !!request,
    retry: false,
  });

export const useDecideConnector = () =>
  useMutation({
    mutationFn: (decision: ConnectorDecision) =>
      api<{ redirectUrl: string }>('/connector/authorize', { method: 'POST', body: decision }).then(
        (data) => data.redirectUrl,
      ),
  });

export const useConnectedApps = () =>
  useQuery({
    queryKey: CONNECTED_APPS_KEY,
    queryFn: () => api<{ apps: ConnectedApp[] }>('/me/connections').then((data) => data.apps),
  });

export const useDisconnectApp = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/me/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: CONNECTED_APPS_KEY }),
  });
};
