import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { notFound } from './lib/httpError';
import { errorHandler } from './middleware/errorHandler';

export const createApp = () => {
  const app = express();
  const api = express.Router();
  const clientDist = config.CLIENT_DIST && path.resolve(config.CLIENT_DIST);

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

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.get('/config', (_req, res) => {
    res.json({ features: { demoData: config.ENABLE_DEMO_DATA } });
  });
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
