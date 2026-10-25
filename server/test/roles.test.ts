import { DEFAULT_ROLE_PERMISSIONS, maskOf } from '@msr/shared/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { agentFor, registerUser, resetDb, roleId, setupTeam } from './helpers';

beforeEach(resetDb);

describe('members', () => {
  it('adds existing users by email with a role', async () => {
    const { owner, project } = await setupTeam();
    const newcomer = agentFor();
    const { email } = await registerUser(newcomer);
    await owner
      .post(`/api/projects/${project.key}/members`)
      .send({ email: 'ghost@test.dev', roleId: roleId(project, 'member') })
      .expect(404);
    await owner
      .post(`/api/projects/${project.key}/members`)
      .send({ email, roleId: roleId(project, 'viewer') })
      .expect(201);
    await owner
      .post(`/api/projects/${project.key}/members`)
      .send({ email, roleId: roleId(project, 'viewer') })
      .expect(409);
    expect((await newcomer.get('/api/projects')).body.projects[0]).toMatchObject({
      key: project.key,
      roleName: 'Viewer',
      isOwner: false,
    });
  });

  it('never assigns the owner role or touches the owner', async () => {
    const { owner, ownerId, project, admin, member } = await setupTeam();
    await owner
      .patch(`/api/projects/${project.key}/members/${member.id}`)
      .send({ roleId: roleId(project, 'owner') })
      .expect(400);
    await admin.agent
      .patch(`/api/projects/${project.key}/members/${ownerId}`)
      .send({ roleId: roleId(project, 'viewer') })
      .expect(403);
    await admin.agent.delete(`/api/projects/${project.key}/members/${ownerId}`).expect(403);
    await owner.delete(`/api/projects/${project.key}/members/${ownerId}`).expect(400);
  });

  it('requires project.manage_members', async () => {
    const { project, member, viewer } = await setupTeam();
    const response = await member.agent
      .patch(`/api/projects/${project.key}/members/${viewer.id}`)
      .send({ roleId: roleId(project, 'member') })
      .expect(403);
    expect(response.body.details.missing).toEqual(['project.manage_members']);
  });

  it('lets members leave, which removes access', async () => {
    const { project, member } = await setupTeam();
    await member.agent.delete(`/api/projects/${project.key}/members/${member.id}`).expect(204);
    await member.agent.get(`/api/projects/${project.key}`).expect(404);
  });
});

describe('roles', () => {
  it('creates custom roles and rejects unknown permission bits', async () => {
    const { owner, project } = await setupTeam();
    const qa = maskOf('task.create', 'task.transition', 'comment.create');
    const { body } = await owner
      .post(`/api/projects/${project.key}/roles`)
      .send({ name: 'QA', permissions: qa })
      .expect(201);
    expect(body.role).toMatchObject({ name: 'QA', systemKey: null, permissions: qa, memberCount: 0 });
    await owner.post(`/api/projects/${project.key}/roles`).send({ name: 'qa', permissions: 0 }).expect(409);
    await owner
      .post(`/api/projects/${project.key}/roles`)
      .send({ name: 'Bad', permissions: 1 << 30 })
      .expect(400);
  });

  it('prevents granting permissions the actor does not hold', async () => {
    const { owner, project, member } = await setupTeam();
    const leadMask = maskOf('project.manage_roles', 'project.manage_members', 'task.create');
    const lead = (
      await owner.post(`/api/projects/${project.key}/roles`).send({ name: 'Lead', permissions: leadMask })
    ).body.role;
    await owner
      .patch(`/api/projects/${project.key}/members/${member.id}`)
      .send({ roleId: lead.id })
      .expect(200);
    await member.agent
      .post(`/api/projects/${project.key}/roles`)
      .send({ name: 'Mega', permissions: maskOf('task.delete') })
      .expect(403);
    await member.agent
      .post(`/api/projects/${project.key}/roles`)
      .send({ name: 'Mini', permissions: maskOf('task.create') })
      .expect(201);
    await member.agent
      .patch(`/api/projects/${project.key}/roles/${roleId(project, 'admin')}`)
      .send({ permissions: 0 })
      .expect(403);
  });

  it('protects the owner role and requires reassignment when deleting', async () => {
    const { owner, project, viewer } = await setupTeam();
    await owner
      .patch(`/api/projects/${project.key}/roles/${roleId(project, 'owner')}`)
      .send({ permissions: 0 })
      .expect(400);
    await owner
      .delete(`/api/projects/${project.key}/roles/${roleId(project, 'viewer')}`)
      .send({ reassignToRoleId: roleId(project, 'member') })
      .expect(400);
    const custom = (
      await owner.post(`/api/projects/${project.key}/roles`).send({ name: 'Guest', permissions: 0 })
    ).body.role;
    await owner
      .patch(`/api/projects/${project.key}/members/${viewer.id}`)
      .send({ roleId: custom.id })
      .expect(200);
    await owner
      .delete(`/api/projects/${project.key}/roles/${custom.id}`)
      .send({ reassignToRoleId: roleId(project, 'owner') })
      .expect(400);
    await owner
      .delete(`/api/projects/${project.key}/roles/${custom.id}`)
      .send({ reassignToRoleId: roleId(project, 'member') })
      .expect(204);
    const { body } = await viewer.agent.get(`/api/projects/${project.key}`).expect(200);
    expect(body.project).toMatchObject({ roleName: 'Member', permissions: DEFAULT_ROLE_PERMISSIONS.member });
  });

  it('applies edited system role permissions to members immediately', async () => {
    const { owner, project, viewer } = await setupTeam();
    await viewer.agent
      .post(`/api/projects/${project.key}/labels`)
      .send({ name: 'ui', color: '#3b82f6' })
      .expect(403);
    await owner
      .patch(`/api/projects/${project.key}/roles/${roleId(project, 'viewer')}`)
      .send({ permissions: maskOf('project.manage_labels') })
      .expect(200);
    await viewer.agent
      .post(`/api/projects/${project.key}/labels`)
      .send({ name: 'ui', color: '#3b82f6' })
      .expect(201);
  });
});
