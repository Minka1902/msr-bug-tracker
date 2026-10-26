import { Router } from 'express';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  createOAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CONNECTOR_SCOPES } from '@msr/shared/enums';
import { connectorDecisionSchema, connectorRequestSchema } from '@msr/shared/schemas/connector';
import { uuidSchema } from '@msr/shared/schemas/project';
import { config } from '../../config';
import { forbidden, notFound } from '../../lib/httpError';
import { buildMcpServer } from './mcp';
import { oauthProvider, type ConnectorAuth } from './oauth';
import { decideRequest, disconnectApp, listConnectedApps, previewRequest } from './service';

const RESOURCE_NAME = 'MSR Tracker';
const OAUTH_PATHS = {
  authorization_endpoint: '/oauth/authorize',
  token_endpoint: '/oauth/token',
  registration_endpoint: '/oauth/register',
  revocation_endpoint: '/oauth/revoke',
};
const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed' },
  id: null,
};

export const createConnectorRouter = (rateLimit: boolean) => {
  const router = Router();
  const issuerUrl = new URL(new URL(config.APP_URL).origin);
  const resourceUrl = new URL('/mcp', issuerUrl);
  const limits = { rateLimit: rateLimit ? undefined : (false as const) };

  const oauthMetadata = {
    ...createOAuthMetadata({ provider: oauthProvider, issuerUrl, scopesSupported: [...CONNECTOR_SCOPES] }),
    ...Object.fromEntries(
      Object.entries(OAUTH_PATHS).map(([field, path]) => [field, new URL(path, issuerUrl).href]),
    ),
  };

  router.use(
    OAUTH_PATHS.authorization_endpoint,
    authorizationHandler({ provider: oauthProvider, ...limits }),
  );
  router.use(OAUTH_PATHS.token_endpoint, tokenHandler({ provider: oauthProvider, ...limits }));
  router.use(
    OAUTH_PATHS.registration_endpoint,
    clientRegistrationHandler({
      clientsStore: oauthProvider.clientsStore,
      clientSecretExpirySeconds: 0,
      ...limits,
    }),
  );
  router.use(OAUTH_PATHS.revocation_endpoint, revocationHandler({ provider: oauthProvider, ...limits }));
  router.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: resourceUrl,
      scopesSupported: [...CONNECTOR_SCOPES],
      resourceName: RESOURCE_NAME,
    }),
  );
  router.use(
    '/.well-known/oauth-protected-resource',
    metadataHandler({
      resource: resourceUrl.href,
      authorization_servers: [issuerUrl.href],
      scopes_supported: [...CONNECTOR_SCOPES],
      resource_name: RESOURCE_NAME,
    }),
  );

  router.post(
    '/mcp',
    requireBearerAuth({
      verifier: oauthProvider,
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
    }),
    async (req, res) => {
      const server = buildMcpServer(req.auth!.extra as unknown as ConnectorAuth);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    },
  );
  router.all('/mcp', (_req, res) => {
    res.status(405).set('Allow', 'POST').json(METHOD_NOT_ALLOWED);
  });

  return router;
};

export const createConnectorApiRouter = () => {
  const router = Router();

  router.get('/connector/request', async (req, res) => {
    res.json({ request: await previewRequest(connectorRequestSchema.parse(req.query).request) });
  });

  router.post('/connector/authorize', async (req, res) => {
    if (req.user!.impersonator) throw forbidden("You can't connect apps while viewing as someone else");
    const { request, approve, scopes } = connectorDecisionSchema.parse(req.body);
    res.json({ redirectUrl: await decideRequest(request, req.user!.id, approve, scopes) });
  });

  router.get('/me/connections', async (req, res) => {
    res.json({ apps: await listConnectedApps(req.user!.id) });
  });

  router.delete('/me/connections/:id', async (req, res) => {
    if (!(await disconnectApp(req.user!.id, uuidSchema.parse(req.params.id))))
      throw notFound('Connection not found');
    res.status(204).end();
  });

  return router;
};
