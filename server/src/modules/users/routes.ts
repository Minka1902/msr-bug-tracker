import { Router } from 'express';
import { changeEmailSchema, changePasswordSchema, updateMeSchema } from '@msr/shared/schemas/auth';
import { badRequest, conflict, notFound } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/passwords';
import { removeStored, sendStored } from '../../lib/storage';
import { deleteUserSessions, sendVerificationEmail } from '../auth/service';
import {
  findUserByEmail,
  findUserById,
  getPasswordHash,
  setAvatarKey,
  setEmail,
  setPassword,
  toCurrentUser,
  updateProfile,
} from './service';

const WRONG_PASSWORD = 'Your current password is incorrect';

export const createUsersRouter = () => {
  const router = Router();

  router.patch('/me', async (req, res) => {
    const input = updateMeSchema.parse(req.body);
    const user = await updateProfile(req.user!.id, input.name, input.preferences);
    res.json({ user: toCurrentUser(user, req.user!.impersonator) });
  });

  router.put('/me/password', async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    if (!(await verifyPassword(await getPasswordHash(req.user!.id), input.currentPassword)))
      throw badRequest(WRONG_PASSWORD);
    await setPassword(req.user!.id, await hashPassword(input.newPassword));
    await deleteUserSessions(req.user!.id, req.sessionId);
    res.status(204).end();
  });

  router.put('/me/email', async (req, res) => {
    const input = changeEmailSchema.parse(req.body);
    if (!(await verifyPassword(await getPasswordHash(req.user!.id), input.password)))
      throw badRequest(WRONG_PASSWORD);
    if (input.email === req.user!.email) throw badRequest('That is already your email');
    if (await findUserByEmail(input.email)) throw conflict('An account with this email already exists');
    const user = await setEmail(req.user!.id, input.email);
    await sendVerificationEmail(user).catch((err) => logger.error({ err }, 'Verification email failed'));
    res.json({ user: toCurrentUser(user, req.user!.impersonator) });
  });

  router.delete('/me/avatar', async (req, res) => {
    await removeStored([await setAvatarKey(req.user!.id, null)]);
    res.json({ user: toCurrentUser((await findUserById(req.user!.id))!, req.user!.impersonator) });
  });

  router.get('/users/:id/avatar', async (req, res) => {
    const user = await findUserById(req.params.id);
    if (!user?.avatar_key) throw notFound();
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    await sendStored(req, res, user.avatar_key);
  });

  return router;
};
