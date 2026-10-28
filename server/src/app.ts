import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { notFound } from './lib/httpError';
import { errorHandler } from './middleware/errorHandler';
import { originCheck } from './middleware/originCheck';
import { createRateLimits } from './middleware/rateLimits';
import { loadSession, requireAuth } from './middleware/session';
import { createAuthRouter } from './modules/auth/routes';
import { createCalendarFeedRouter, createCalendarRouter } from './modules/calendar/routes';
import { googleConfigured } from './modules/calendar/google';
import { createDevRouter } from './modules/dev/routes';
import { createProjectsRouter } from './modules/projects/routes';
import { createTasksRouter } from './modules/tasks/routes';
import { createAttachmentsRouter } from './modules/attachments/routes';
import { createChecklistRouter } from './modules/checklist/routes';
import { createCommentsRouter } from './modules/comments/routes';
import { createConnectorApiRouter, createConnectorRouter } from './modules/connector/routes';
import { createRelationsRouter } from './modules/relations/routes';
import { createInsightsRouter } from './modules/insights/routes';
import { createSearchRouter } from './modules/search/routes';
import { createShopRouter } from './modules/shop/routes';
import { createDemoRouter } from './modules/demo/routes';
import { createImportTemplateRouter } from './modules/importer/routes';
import { createInvitesRouter } from './modules/invites/routes';
import { createMigrationsRouter } from './modules/migrations/routes';
import { createAiKeysRouter } from './modules/aiKeys/routes';
import { createTwoFactorRouter } from './modules/twoFactor/routes';
import { createUsersRouter } from './modules/users/routes';

const noCache = (res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache');
};

interface AppOptions {
  rateLimit?: boolean;
  demoData?: boolean;
  clientDist?: string;
}

export const createApp = ({
  rateLimit = config.rateLimit,
  demoData = config.ENABLE_DEMO_DATA,
  clientDist = config.CLIENT_DIST && path.resolve(config.CLIENT_DIST),
}: AppOptions = {}) => {
  const app = express();
  const api = express.Router();
  const limits = createRateLimits(rateLimit);

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'media-src': ["'self'", 'blob:'],
          'connect-src': ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  api.use(originCheck, loadSession);
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.get('/config', (_req, res) => {
    res.json({ features: { demoData, googleCalendar: googleConfigured() } });
  });
  api.use('/auth', createAuthRouter(limits));
  api.use('/calendar-feed', createCalendarFeedRouter(limits));
  if (config.devMailbox) api.use('/dev', createDevRouter());
  api.use(requireAuth);
  api.use(createUsersRouter());
  api.use(createConnectorApiRouter());
  api.use('/me/2fa', createTwoFactorRouter(limits));
  api.use('/me/ai-keys', createAiKeysRouter(limits));
  api.use('/invites', createInvitesRouter(limits));
  api.use('/import', createImportTemplateRouter());
  api.use('/migrations', createMigrationsRouter(limits));
  api.use('/calendar', createCalendarRouter(limits));
  api.use('/shop', createShopRouter(limits));
  api.use('/projects', createProjectsRouter());
  api.use(createAttachmentsRouter());
  api.use(createCommentsRouter());
  api.use(createChecklistRouter());
  api.use(createRelationsRouter());
  api.use(createInsightsRouter());
  api.use(createSearchRouter());
  if (demoData) api.use('/demo', createDemoRouter(limits));
  api.use('/tasks', createTasksRouter());
  api.use(() => {
    throw notFound();
  });

  app.use(createConnectorRouter(rateLimit));
  app.use('/api', api);

  if (clientDist && fs.existsSync(clientDist)) {
    app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
    app.use('/assets', (_req, res) => {
      res.sendStatus(404);
    });
    app.use(express.static(clientDist, { index: false, cacheControl: false, setHeaders: noCache }));
    app.get('/{*splat}', (_req, res) => {
      noCache(res);
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
};
