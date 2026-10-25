import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@msr/shared/schemas/auth';
import { transaction } from '../../db/pool';
import { badGateway, badRequest, conflict, unauthorized } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/passwords';
import { clearSessionCookie, setSessionCookie } from '../../lib/sessionCookie';
import { requireAuth } from '../../middleware/session';
import type { RateLimits } from '../../middleware/rateLimits';
import { findUserByEmail, insertUser, markEmailVerified, setPassword, toCurrentUser } from '../users/service';
import {
  consumeToken,
  createSession,
  deleteSession,
  deleteUserSessions,
  isVerifiedToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './service';

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_LINK = 'This link is invalid or has expired';
const MAIL_FAILED = "We couldn't send the email. Please try again in a few minutes.";

export const createAuthRouter = (limits: RateLimits) => {
  const router = Router();

  router.post('/register', limits.register, async (req, res) => {
    const input = registerSchema.parse(req.body);
    if (await findUserByEmail(input.email)) throw conflict('An account with this email already exists');
    const user = await insertUser(
      input.name,
      input.email,
      await hashPassword(input.password),
      input.timezone ? { timezone: input.timezone } : {},
    );
    setSessionCookie(res, await createSession(req, user.id));
    await sendVerificationEmail(user).catch((err) => logger.error({ err }, 'Verification email failed'));
    res.status(201).json({ user: toCurrentUser(user) });
  });

  router.post('/login', limits.login, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await findUserByEmail(input.email);
    const valid = await verifyPassword(user?.password_hash, input.password);
    if (!user || !user.password_hash || !valid) throw unauthorized(INVALID_CREDENTIALS);
    if (req.sessionId) await deleteSession(req.sessionId);
    setSessionCookie(res, await createSession(req, user.id));
    res.json({ user: toCurrentUser(user) });
  });

  router.post('/logout', async (req, res) => {
    if (req.sessionId) await deleteSession(req.sessionId);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: toCurrentUser(req.user!, req.user!.impersonator) });
  });

  router.post('/verify-email', limits.emailAction, async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    const verified = await transaction(async (db) => {
      const consumed = await consumeToken(token, 'verify_email', db);
      return consumed ? markEmailVerified(consumed.user_id, consumed.email, db) : false;
    });
    if (!verified && !(await isVerifiedToken(token))) throw badRequest(INVALID_LINK);
    res.status(204).end();
  });

  router.post('/resend-verification', requireAuth, limits.emailAction, async (req, res) => {
    if (!req.user!.email_verified_at)
      await sendVerificationEmail(req.user!).catch((err) => {
        logger.error({ err }, 'Verification email failed');
        throw badGateway(MAIL_FAILED);
      });
    res.status(204).end();
  });

  router.post('/forgot-password', limits.emailAction, async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (user?.password_hash) await sendPasswordResetEmail(user);
    res.status(204).end();
  });

  router.post('/reset-password', limits.emailAction, async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const reset = await transaction(async (db) => {
      const consumed = await consumeToken(input.token, 'reset_password', db);
      if (!consumed) return false;
      await setPassword(consumed.user_id, passwordHash, db);
      await deleteUserSessions(consumed.user_id, null, db);
      return true;
    });
    if (!reset) throw badRequest(INVALID_LINK);
    clearSessionCookie(res);
    res.status(204).end();
  });

  return router;
};
