import { Router } from 'express';
import { createRoleSchema, deleteRoleSchema, updateRoleSchema } from '@msr/shared/schemas/project';
import { badRequest } from '../../lib/httpError';
import { assertCanWrite, assertCovers, projectOf } from '../projects/access';
import { createRole, deleteRole, getRole, listRoles, updateRole } from './service';

export const createRolesRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    res.json({ roles: await listRoles(projectOf(req).id) });
  });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_roles');
    const input = createRoleSchema.parse(req.body);
    assertCovers(project, input.permissions);
    res.status(201).json({ role: await createRole(project.id, input.name, input.permissions) });
  });

  router.patch('/:roleId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_roles');
    const input = updateRoleSchema.parse(req.body);
    const role = await getRole(project.id, req.params.roleId!);
    if (role.system_key === 'owner') throw badRequest("The owner role can't be changed");
    if (role.system_key && input.name !== undefined && input.name !== role.name)
      throw badRequest("Built-in roles can't be renamed");
    assertCovers(project, role.permissions, input.permissions ?? 0);
    res.json({ role: await updateRole(project.id, role.id, input) });
  });

  router.delete('/:roleId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_roles');
    const { reassignToRoleId } = deleteRoleSchema.parse(req.body);
    const role = await getRole(project.id, req.params.roleId!);
    if (role.system_key) throw badRequest("Built-in roles can't be deleted");
    const target = await getRole(project.id, reassignToRoleId);
    if (target.id === role.id || target.system_key === 'owner')
      throw badRequest('Choose another role for its members');
    assertCovers(project, role.permissions, target.permissions);
    await deleteRole(role.id, target.id);
    res.status(204).end();
  });

  return router;
};
