import { Router } from 'express';
import { createInviteSchema, createProjectInviteSchema } from '@msr/shared/schemas/project';
import { tokenSchema } from '@msr/shared/schemas/auth';
import { badGateway, badRequest, forbidden, notFound } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import type { RateLimits } from '../../middleware/rateLimits';
import { assertCan, assertCanWrite, assertCovers, projectOf } from '../projects/access';
import { getRole } from '../roles/service';
import {
  acceptInvite,
  createInvite,
  deleteInvite,
  listProjectInvites,
  previewInvite,
  revokeProjectInvite,
  sendInviteEmail,
} from './service';

const INVALID_INVITE = 'This invite is invalid, used up or has expired';
const MAIL_FAILED = "We couldn't send the invite email. Copy the link and share it another way.";

const emailInvite = async (invite: Awaited<ReturnType<typeof createInvite>>) => {
  if (!invite.email) return;
  try {
    await sendInviteEmail(invite);
  } catch (err) {
    logger.error({ err }, 'Invite email failed');
    await deleteInvite(invite.id);
    throw badGateway(MAIL_FAILED);
  }
};

export const createProjectInvitesRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const project = projectOf(req);
    assertCan(project, 'project.manage_members');
    res.json({ invites: await listProjectInvites(project.id) });
  });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_members');
    const input = createProjectInviteSchema.parse(req.body);
    const role = await getRole(project.id, input.roleId);
    if (role.system_key === 'owner') throw badRequest('A project has exactly one owner');
    assertCovers(project, role.permissions);
    const invite = await createInvite({
      ...input,
      inviterId: req.user!.id,
      projectId: project.id,
      roleId: role.id,
    });
    await emailInvite(invite);
    res.status(201).json({ invite });
  });

  router.delete('/:id', async (req, res) => {
    const project = projectOf(req);
    assertCan(project, 'project.manage_members');
    if (!(await revokeProjectInvite(req.params.id!, project.id))) throw notFound('Invite not found');
    res.status(204).end();
  });

  return router;
};

export const createInvitesRouter = (limits: RateLimits) => {
  const router = Router();

  router.post('/', limits.invites, async (req, res) => {
    const input = createInviteSchema.parse(req.body);
    const invite = await createInvite({ ...input, inviterId: req.user!.id, projectId: null, roleId: null });
    await emailInvite(invite);
    res.status(201).json({ invite });
  });

  router.post('/:token/accept', async (req, res) => {
    if (req.user!.impersonator) throw forbidden('Switch back to your own account to accept invites');
    const result = await acceptInvite(tokenSchema.parse(req.params.token), req.user!);
    if (!result) throw notFound(INVALID_INVITE);
    res.json(result);
  });

  return router;
};

export const createInvitePreviewRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/:token', limits.invitePreview, async (req, res) => {
    const invite = await previewInvite(tokenSchema.parse(req.params.token));
    if (!invite) throw notFound(INVALID_INVITE);
    res.json({ invite });
  });

  return router;
};
