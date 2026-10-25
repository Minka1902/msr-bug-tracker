import { Router } from 'express';
import { addMemberSchema, updateMemberSchema } from '@msr/shared/schemas/project';
import { badRequest, forbidden, notFound } from '../../lib/httpError';
import { assertCanWrite, assertCovers, projectOf } from '../projects/access';
import { getRole } from '../roles/service';
import { findUserByEmail } from '../users/service';
import { addMember, changeMemberRole, getMember, listMembers, removeMember } from './service';

export const createMembersRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    res.json({ members: await listMembers(projectOf(req).id) });
  });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_members');
    const input = addMemberSchema.parse(req.body);
    const user = await findUserByEmail(input.email);
    if (!user || (user.demo_owner_id && user.demo_owner_id !== req.user!.id))
      throw notFound('No account uses that email');
    const role = await getRole(project.id, input.roleId);
    if (role.system_key === 'owner') throw badRequest('A project has exactly one owner');
    assertCovers(project, role.permissions);
    res.status(201).json({ member: await addMember(project.id, user.id, role.id) });
  });

  router.patch('/:userId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_members');
    const role = await getRole(project.id, updateMemberSchema.parse(req.body).roleId);
    if (role.system_key === 'owner') throw badRequest('A project has exactly one owner');
    const member = await getMember(project.id, req.params.userId!);
    if (!member) throw notFound('Member not found');
    if (member.is_owner) throw forbidden("The owner's role can't be changed");
    assertCovers(project, member.role_permissions, role.permissions);
    res.json({ member: await changeMemberRole(project.id, member.id, role.id) });
  });

  router.delete('/:userId', async (req, res) => {
    const project = projectOf(req);
    const member = await getMember(project.id, req.params.userId!);
    if (!member) throw notFound('Member not found');
    const leaving = member.id === req.user!.id;
    if (leaving && member.is_owner) throw badRequest("The owner can't leave their own project");
    if (!leaving) {
      assertCanWrite(project, 'project.manage_members');
      if (member.is_owner) throw forbidden("The owner can't be removed");
      assertCovers(project, member.role_permissions);
    }
    await removeMember(project.id, member, req.user!.id);
    res.status(204).end();
  });

  return router;
};
