import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const MINUTE = 60_000;

const limiter = (windowMs: number, limit: number, key?: (req: Request) => string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: key ?? ((req) => ipKeyGenerator(req.ip ?? '')),
    message: { error: 'Too many requests, please try again later' },
  });

const emailKey = (req: Request) =>
  `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`;

const secondFactorKey = (req: Request) =>
  `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.ticket ?? req.user?.id ?? '')}`;

export const createRateLimits = (enabled: boolean) => {
  const passthrough: RequestHandler = (_req, _res, next) => next();
  const make = (...args: Parameters<typeof limiter>) => (enabled ? limiter(...args) : passthrough);

  return {
    login: make(15 * MINUTE, 10, emailKey),
    register: make(60 * MINUTE, 5),
    emailAction: make(60 * MINUTE, 5),
    demo: make(60 * MINUTE, 10),
    twoFactor: make(15 * MINUTE, 10, secondFactorKey),
  };
};

export type RateLimits = ReturnType<typeof createRateLimits>;
