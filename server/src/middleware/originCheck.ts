import type { RequestHandler } from 'express';
import { config } from '../config';
import { forbidden } from '../lib/httpError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_ORIGIN = new URL(config.APP_URL).origin;

export const originCheck: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin ? origin !== ALLOWED_ORIGIN : req.get('sec-fetch-site') === 'cross-site')
    throw forbidden('Cross-origin request blocked');
  next();
};
