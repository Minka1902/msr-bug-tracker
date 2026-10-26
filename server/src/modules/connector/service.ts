import { CONNECTOR_SCOPES, type ConnectorScope } from '@msr/shared/enums';
import type { ConnectedApp, ConnectorRequestPreview } from '@msr/shared/types';
import { query } from '../../db/pool';
import { badRequest } from '../../lib/httpError';
import { hashToken, randomToken } from '../../lib/tokens';
import { clientsStore, openRequest } from './oauth';

const CODE_TTL_MINUTES = 5;

const INSERT_CODE = `
  INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scopes, resource, expires_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8))`;
const LIST_GRANTS = `
  SELECT g.id, c.metadata->>'client_name' AS client_name, c.metadata->'redirect_uris'->>0 AS redirect_uri,
         g.scopes, g.created_at, g.last_used_at
  FROM oauth_grants g
  JOIN oauth_clients c ON c.id = g.client_id
  WHERE g.user_id = $1 AND g.refresh_expires_at > now()
  ORDER BY g.created_at DESC`;
const DELETE_GRANT = 'DELETE FROM oauth_grants WHERE id = $1 AND user_id = $2 RETURNING id';
const PURGE_EXPIRED = `
  WITH codes AS (DELETE FROM oauth_codes WHERE expires_at < now())
  DELETE FROM oauth_grants WHERE refresh_expires_at < now()`;

interface GrantRow {
  id: string;
  client_name: string | null;
  redirect_uri: string;
  scopes: ConnectorScope[];
  created_at: Date;
  last_used_at: Date;
}

const allowedScopes = (requested: string[]) => {
  const known = CONNECTOR_SCOPES.filter((scope) => requested.includes(scope));
  return known.length ? known : [...CONNECTOR_SCOPES];
};

const loadRequest = async (sealed: string) => {
  const request = openRequest(sealed);
  const client = await clientsStore.getClient(request.clientId);
  if (!client) throw badRequest('This app is no longer registered. Start connecting again.');
  return { request, client, redirect: new URL(request.redirectUri) };
};

export const previewRequest = async (sealed: string): Promise<ConnectorRequestPreview> => {
  const { request, client, redirect } = await loadRequest(sealed);
  return {
    clientName: client.client_name?.trim() || redirect.host,
    redirectHost: redirect.host,
    scopes: allowedScopes(request.scopes),
  };
};

export const decideRequest = async (
  sealed: string,
  userId: string,
  approve: boolean,
  chosen: ConnectorScope[],
) => {
  const { request, redirect } = await loadRequest(sealed);
  if (request.state) redirect.searchParams.set('state', request.state);
  if (!approve) {
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'The user declined the connection');
    return redirect.href;
  }
  const allowed = allowedScopes(request.scopes);
  const scopes = CONNECTOR_SCOPES.filter(
    (scope) => scope === 'read' || (chosen.includes(scope) && allowed.includes(scope)),
  );
  const code = randomToken();
  await query(INSERT_CODE, [
    hashToken(code),
    request.clientId,
    userId,
    request.redirectUri,
    request.codeChallenge,
    scopes,
    request.resource,
    CODE_TTL_MINUTES,
  ]);
  redirect.searchParams.set('code', code);
  return redirect.href;
};

export const listConnectedApps = async (userId: string): Promise<ConnectedApp[]> =>
  (await query<GrantRow>(LIST_GRANTS, [userId])).map((row) => {
    const host = URL.canParse(row.redirect_uri) ? new URL(row.redirect_uri).host : '';
    return {
      id: row.id,
      name: row.client_name?.trim() || host,
      host,
      scopes: row.scopes,
      connectedAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at.toISOString(),
    };
  });

export const disconnectApp = async (userId: string, grantId: string) =>
  (await query(DELETE_GRANT, [grantId, userId])).length > 0;

export const purgeExpiredGrants = () => query(PURGE_EXPIRED);
