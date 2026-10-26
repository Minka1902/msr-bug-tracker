import { Router, type Request } from 'express';
import {
  twoFactorCodeInputSchema,
  twoFactorDisableSchema,
  twoFactorSetupSchema,
} from '@msr/shared/schemas/auth';
import { badRequest, forbidden } from '../../lib/httpError';
import { verifyPassword } from '../../lib/passwords';
import type { RateLimits } from '../../middleware/rateLimits';
import { findUserById, getPasswordHash, toCurrentUser } from '../users/service';
import {
  disableTwoFactor,
  enableTwoFactor,
  recoveryCodesLeft,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
  verifySecondFactor,
} from './service';

const WRONG_PASSWORD = 'Your password is incorrect';
const WRONG_CODE = "That code didn't work. Check the time on your phone and try the newest code.";

const assertOwnAccount = async (req: Request, password?: string) => {
  if (req.user!.impersonator) throw forbidden('Switch back to your own account to change security settings');
  if (password !== undefined && !(await verifyPassword(await getPasswordHash(req.user!.id), password)))
    throw badRequest(WRONG_PASSWORD);
};

const currentUser = async (req: Request) => toCurrentUser((await findUserById(req.user!.id))!);

export const createTwoFactorRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json({
      enabled: req.user!.totp_enabled_at !== null,
      recoveryCodesLeft: await recoveryCodesLeft(req.user!.id),
    });
  });

  router.post('/setup', limits.twoFactor, async (req, res) => {
    await assertOwnAccount(req, twoFactorSetupSchema.parse(req.body).password);
    res.json(await startTwoFactorSetup(req.user!.id));
  });

  router.post('/enable', limits.twoFactor, async (req, res) => {
    await assertOwnAccount(req);
    const recoveryCodes = await enableTwoFactor(req.user!.id, twoFactorCodeInputSchema.parse(req.body).code);
    if (!recoveryCodes) throw badRequest(WRONG_CODE);
    res.json({ recoveryCodes, user: await currentUser(req) });
  });

  router.post('/recovery-codes', limits.twoFactor, async (req, res) => {
    await assertOwnAccount(req);
    if (!(await verifySecondFactor(req.user!.id, twoFactorCodeInputSchema.parse(req.body).code)))
      throw badRequest(WRONG_CODE);
    res.json({ recoveryCodes: await regenerateRecoveryCodes(req.user!.id) });
  });

  router.post('/disable', limits.twoFactor, async (req, res) => {
    const input = twoFactorDisableSchema.parse(req.body);
    await assertOwnAccount(req, input.password);
    if (!(await verifySecondFactor(req.user!.id, input.code))) throw badRequest(WRONG_CODE);
    await disableTwoFactor(req.user!.id);
    res.json({ user: await currentUser(req) });
  });

  return router;
};
