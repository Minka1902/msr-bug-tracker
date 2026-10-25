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
import { createDevRouter } from './modules/dev/routes';
import { createProjectsRouter } from './modules/projects/routes';
import { createTasksRouter } from './modules/tasks/routes';
import { createUsersRouter } from './modules/users/routes';

interface AppOptions {
  rateLimit?: boolean;
}

export const createApp = ({ rateLimit = true }: AppOptions = {}) => {
  const app = express();
  const api = express.Router();
  const clientDist = config.CLIENT_DIST && path.resolve(config.CLIENT_DIST);
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
    res.json({ features: { demoData: config.ENABLE_DEMO_DATA } });
  });
  api.use('/auth', createAuthRouter(limits));
  if (config.devMailbox) api.use('/dev', createDevRouter());
  api.use(requireAuth);
  api.use(createUsersRouter());
  api.use('/projects', createProjectsRouter());
  api.use('/tasks', createTasksRouter());
  api.use(() => {
    throw notFound();
  });

  app.use('/api', api);

  if (clientDist && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1y', immutable: true }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
};
