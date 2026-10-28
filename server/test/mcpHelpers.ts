import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import { config } from '../src/config';
import { testApp, type Agent } from './helpers';

export const app = testApp();
export const ORIGIN = new URL(config.APP_URL).origin;
export const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
export const ACCEPT = 'application/json, text/event-stream';

export interface Client {
  client_id: string;
  client_secret: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
}

export const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

export const registerClient = async (name = 'Claude') =>
  (
    await request(app)
      .post('/oauth/register')
      .send({
        client_name: name,
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      })
      .expect(201)
  ).body as Client;

export const startAuthorization = async (client: Client, challenge: string, scope = 'read write') => {
  const response = await request(app)
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'state-123',
      scope,
      resource: `${ORIGIN}/mcp`,
    })
    .expect(302);
  const consent = new URL(response.headers.location!);
  expect(consent.origin + consent.pathname).toBe(`${ORIGIN}/connect/authorize`);
  return consent.searchParams.get('request')!;
};

export const approve = async (agent: Agent, sealed: string, scopes: string[]) => {
  const { body } = await agent
    .post('/api/connector/authorize')
    .send({ request: sealed, approve: true, scopes })
    .expect(200);
  const redirect = new URL(body.redirectUrl);
  expect(redirect.origin + redirect.pathname).toBe(REDIRECT_URI);
  expect(redirect.searchParams.get('state')).toBe('state-123');
  return redirect.searchParams.get('code')!;
};

export const exchange = (client: Client, code: string, verifier: string) =>
  request(app).post('/oauth/token').type('form').send({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    client_id: client.client_id,
    client_secret: client.client_secret,
  });

export const connect = async (agent: Agent, scopes = ['read', 'write'], client?: Client) => {
  const registered = client ?? (await registerClient());
  const { verifier, challenge } = pkce();
  const code = await approve(agent, await startAuthorization(registered, challenge), scopes);
  const tokens = (await exchange(registered, code, verifier).expect(200)).body as Tokens;
  return { client: registered, tokens };
};

let rpcId = 0;
export const rpc = (token: string, method: string, params: Record<string, unknown> = {}) =>
  request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', ACCEPT)
    .send({ jsonrpc: '2.0', id: ++rpcId, method, params });

export const toolNames = async (token: string) =>
  ((await rpc(token, 'tools/list').expect(200)).body.result.tools as { name: string }[]).map(
    (tool) => tool.name,
  );

export const call = async (token: string, name: string, args: Record<string, unknown>) => {
  const { result } = (await rpc(token, 'tools/call', { name, arguments: args }).expect(200)).body as {
    result: { isError?: boolean; content: { text: string }[] };
  };
  const text = result.content[0]!.text;
  return { isError: !!result.isError, text, data: result.isError ? null : JSON.parse(text) };
};
