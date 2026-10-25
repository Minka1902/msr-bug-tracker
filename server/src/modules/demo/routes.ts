import { Router, type Request } from 'express';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../../lib/httpError';
import { setSessionCookie } from '../../lib/sessionCookie';
import type { RateLimits } from '../../middleware/rateLimits';
import { createSession, deleteSession } from '../auth/service';
import { findUserById, toCurrentUser, toUserRef } from '../users/service';
import { generateDemo, getDemoStatus, isOwnDemoUser, removeDemo } from './service';

const generateSchema = z.object({
  size: z.enum(['small', 'large']).default('small'),
  seed: z.coerce.number().int().min(1).max(2_147_483_647).optional(),
});

const assertRealUser = (req: Request) => {
  if (req.user!.impersonator || req.user!.demo_owner_id)
    throw forbidden('Switch back to your own account to manage demo data');
};

export const createDemoRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json({ status: await getDemoStatus(req.user!.impersonator?.id ?? req.user!.id) });
  });

  router.post('/', limits.demo, async (req, res) => {
    assertRealUser(req);
    const { size, seed = Math.floor(Math.random() * 1_000_000) + 1 } = generateSchema.parse(req.body);
    await generateDemo(req.user!.id, size, seed);
    res.status(201).json({ status: await getDemoStatus(req.user!.id) });
  });

  router.delete('/', async (req, res) => {
    assertRealUser(req);
    await removeDemo(req.user!.id);
    res.status(204).end();
  });

  router.post('/impersonate/stop', async (req, res) => {
    const impersonator = req.user!.impersonator;
    if (!impersonator) throw badRequest('You are not viewing as a teammate');
    await deleteSession(req.sessionId!);
    setSessionCookie(res, await createSession(req, impersonator.id));
    res.json({ user: toCurrentUser((await findUserById(impersonator.id))!) });
  });

  router.post('/impersonate/:userId', async (req, res) => {
    if (req.user!.impersonator) throw badRequest('Switch back to your own account first');
    if (!(await isOwnDemoUser(req.params.userId, req.user!.id))) throw notFound('Demo teammate not found');
    await deleteSession(req.sessionId!);
    setSessionCookie(res, await createSession(req, req.params.userId, req.user!.id));
    const target = (await findUserById(req.params.userId))!;
    res.json({ user: toCurrentUser(target, toUserRef(req.user!)) });
  });

  return router;
};
