import type { Response } from 'express';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { config } from '../../config';
import { prepared, query, queryOne } from '../../db/pool';
import { badRequest } from '../../lib/httpError';
import { openSecret, sealSecret } from '../../lib/secretBox';
import { hashToken, randomToken } from '../../lib/tokens';
import type { UserRow } from '../users/service';

export const CONSENT_PATH = '/connect/authorize';

const REQUEST_TTL_MS = 10 * 60_000;
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_DAYS = 60;
const TOUCH_AFTER_MS = 3_600_000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const GET_CLIENT = 'SELECT secret_sealed, metadata FROM oauth_clients WHERE id = $1';
const INSERT_CLIENT = 'INSERT INTO oauth_clients (id, secret_sealed, metadata) VALUES ($1, $2, $3)';
const CODE_CHALLENGE = `
  SELECT code_challenge FROM oauth_codes WHERE code_hash = $1 AND client_id = $2 AND expires_at > now()`;
const EXCHANGE_CODE = `
  WITH code AS (
    DELETE FROM oauth_codes WHERE code_hash = $1 AND client_id = $2 AND expires_at > now()
    RETURNING user_id, redirect_uri, scopes, resource
  )
  INSERT INTO oauth_grants (client_id, user_id, scopes, resource, access_hash, access_expires_at, refresh_hash, refresh_expires_at)
  SELECT $2, user_id, scopes, resource, $3, now() + make_interval(secs => $5), $4, now() + make_interval(days => $6)
  FROM code WHERE $7::text IS NULL OR redirect_uri = $7
  RETURNING scopes`;
const REFRESH = `
  UPDATE oauth_grants
  SET access_hash = $3, access_expires_at = now() + make_interval(secs => $5),
      refresh_hash = $4, refresh_expires_at = now() + make_interval(days => $6),
      scopes = COALESCE($7, scopes)
  WHERE refresh_hash = $1 AND client_id = $2 AND refresh_expires_at > now() AND ($7::text[] IS NULL OR $7 <@ scopes)
  RETURNING scopes`;
const VERIFY_ACCESS = `
  SELECT g.id AS grant_id, g.client_id, g.scopes, g.resource, g.access_expires_at, g.last_used_at,
         u.id, u.email, u.name, u.avatar_key, u.email_verified_at, u.totp_enabled_at, u.preferences, u.created_at,
         u.demo_owner_id
  FROM oauth_grants g
  JOIN users u ON u.id = g.user_id
  WHERE g.access_hash = $1 AND g.access_expires_at > now()`;
const TOUCH_GRANT = 'UPDATE oauth_grants SET last_used_at = now() WHERE id = $1';
const REVOKE = 'DELETE FROM oauth_grants WHERE client_id = $2 AND (access_hash = $1 OR refresh_hash = $1)';

interface ClientRow {
  secret_sealed: string | null;
  metadata: Omit<OAuthClientInformationFull, 'client_secret'>;
}

interface AccessRow extends UserRow {
  grant_id: string;
  client_id: string;
  scopes: string[];
  resource: string | null;
  access_expires_at: Date;
  last_used_at: Date;
}

interface SealedRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scopes: string[];
  resource: string | null;
  expiresAt: number;
}

export interface ConnectorAuth {
  user: UserRow;
  scopes: string[];
}

const isSafeRedirect = (uri: string) => {
  const url = new URL(uri);
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
};

const issueTokens = () => {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  return {
    tokens: {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refreshToken,
    } satisfies OAuthTokens,
    accessHash: hashToken(accessToken),
    refreshHash: hashToken(refreshToken),
  };
};

export const sealRequest = (clientId: string, params: AuthorizationParams) =>
  sealSecret(
    JSON.stringify({
      clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state ?? null,
      scopes: params.scopes ?? [],
      resource: params.resource?.href ?? null,
      expiresAt: Date.now() + REQUEST_TTL_MS,
    } satisfies SealedRequest),
  );

export const openRequest = (sealed: string) => {
  let request: SealedRequest;
  try {
    request = JSON.parse(openSecret(sealed));
  } catch {
    throw badRequest('This connection request is not valid. Start connecting again from Claude or ChatGPT.');
  }
  if (request.expiresAt < Date.now())
    throw badRequest('This connection request has expired. Start connecting again from Claude or ChatGPT.');
  return request;
};

export const clientsStore: OAuthRegisteredClientsStore = {
  getClient: async (clientId) => {
    const row = await queryOne<ClientRow>(GET_CLIENT, [clientId]);
    if (!row) return undefined;
    return { ...row.metadata, ...(row.secret_sealed && { client_secret: openSecret(row.secret_sealed) }) };
  },
  registerClient: async (registration) => {
    const client = registration as OAuthClientInformationFull;
    if (!client.redirect_uris.every(isSafeRedirect))
      throw new InvalidClientMetadataError('Redirect URIs must use https, or http on localhost');
    const { client_secret, ...metadata } = client;
    await query(INSERT_CLIENT, [
      client.client_id,
      client_secret ? sealSecret(client_secret) : null,
      metadata,
    ]);
    return client;
  },
};

export const oauthProvider: OAuthServerProvider = {
  clientsStore,

  authorize: async (client, params: AuthorizationParams, res: Response) => {
    const url = new URL(CONSENT_PATH, config.APP_URL);
    url.searchParams.set('request', sealRequest(client.client_id, params));
    res.redirect(302, url.href);
  },

  challengeForAuthorizationCode: async (client, code) => {
    const row = await queryOne<{ code_challenge: string }>(CODE_CHALLENGE, [
      hashToken(code),
      client.client_id,
    ]);
    if (!row) throw new InvalidGrantError('This authorization code is invalid or has expired');
    return row.code_challenge;
  },

  exchangeAuthorizationCode: async (client, code, _verifier, redirectUri) => {
    const { tokens, accessHash, refreshHash } = issueTokens();
    const row = await queryOne<{ scopes: string[] }>(EXCHANGE_CODE, [
      hashToken(code),
      client.client_id,
      accessHash,
      refreshHash,
      ACCESS_TTL_SECONDS,
      REFRESH_TTL_DAYS,
      redirectUri ?? null,
    ]);
    if (!row) throw new InvalidGrantError('This authorization code is invalid or has expired');
    return { ...tokens, scope: row.scopes.join(' ') };
  },

  exchangeRefreshToken: async (client, refreshToken, scopes) => {
    const { tokens, accessHash, refreshHash } = issueTokens();
    const row = await queryOne<{ scopes: string[] }>(REFRESH, [
      hashToken(refreshToken),
      client.client_id,
      accessHash,
      refreshHash,
      ACCESS_TTL_SECONDS,
      REFRESH_TTL_DAYS,
      scopes?.length ? scopes : null,
    ]);
    if (!row) throw new InvalidGrantError('This refresh token is invalid or has expired');
    return { ...tokens, scope: row.scopes.join(' ') };
  },

  verifyAccessToken: async (token): Promise<AuthInfo> => {
    const [row] = await prepared<AccessRow>('verify-oauth-access', VERIFY_ACCESS, [hashToken(token)]);
    if (!row) throw new InvalidTokenError('This access token is invalid or has expired');
    const { grant_id, client_id, scopes, resource, access_expires_at, last_used_at, ...user } = row;
    if (Date.now() - last_used_at.getTime() > TOUCH_AFTER_MS) await query(TOUCH_GRANT, [grant_id]);
    return {
      token,
      clientId: client_id,
      scopes,
      expiresAt: Math.floor(access_expires_at.getTime() / 1000),
      ...(resource && { resource: new URL(resource) }),
      extra: { user, scopes } satisfies ConnectorAuth,
    };
  },

  revokeToken: async (client, { token }) => {
    await query(REVOKE, [hashToken(token), client.client_id]);
  },
};
