import { maskOf } from '@msr/shared/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { mailbox } from '../src/lib/mailer';
import { addMember, agentFor, createProject, registerUser, resetDb, roleId, setupTeam } from './helpers';

beforeEach(resetDb);

const tokenOf = (url: string) => url.split('/invite/')[1]!;

describe('invites', () => {
  it('creates a project invite, previews it publicly and adds whoever accepts with that role', async () => {
    const { owner, project } = await setupTeam();
    const { body } = await owner
      .post(`/api/projects/${project.key}/invites`)
      .send({ roleId: roleId(project, 'member'), maxUses: 2 })
      .expect(201);
    expect(body.invite).toMatchObject({
      projectName: 'Website Redesign',
      roleName: 'Member',
      maxUses: 2,
      uses: 0,
    });
    expect(body.invite.url).toMatch(/^http:\/\/localhost:5173\/invite\/[\w-]{43}$/);
    const token = tokenOf(body.invite.url);
    const preview = await agentFor().get(`/api/auth/invites/${token}`).expect(200);
    expect(preview.body.invite).toMatchObject({ project: { key: 'WEB' }, roleName: 'Member', email: null });

    const guest = agentFor();
    const { user } = await registerUser(guest);
    expect((await guest.post(`/api/invites/${token}/accept`).expect(200)).body).toEqual({
      projectKey: 'WEB',
      joined: true,
    });
    expect((await guest.post(`/api/invites/${token}/accept`).expect(200)).body.joined).toBe(false);
    const members = (await owner.get(`/api/projects/${project.key}/members`).expect(200)).body.members;
    expect(members.find((member: { id: string }) => member.id === user.id).roleName).toBe('Member');

    const third = agentFor();
    await registerUser(third);
    await third.post(`/api/invites/${token}/accept`).expect(200);
    const fourth = agentFor();
    await registerUser(fourth);
    await fourth.post(`/api/invites/${token}/accept`).expect(404);
    await agentFor().get(`/api/auth/invites/${token}`).expect(404);
  });

  it('emails single-use invites and verifies the address of whoever accepts them', async () => {
    const { owner, project } = await setupTeam();
    const { body } = await owner
      .post(`/api/projects/${project.key}/invites`)
      .send({ roleId: roleId(project, 'viewer'), email: 'Friend@Test.dev', maxUses: null })
      .expect(201);
    expect(body.invite).toMatchObject({ email: 'friend@test.dev', maxUses: 1 });
    const mail = mailbox.at(-1)!;
    expect(mail.to).toBe('friend@test.dev');
    expect(mail.subject).toContain('Website Redesign');
    expect(mail.text).toContain(body.invite.url);
    const friend = agentFor();
    await registerUser(friend, { email: 'friend@test.dev' });
    await friend.post(`/api/invites/${tokenOf(body.invite.url)}/accept`).expect(200);
    expect((await friend.get('/api/auth/me')).body.user.emailVerified).toBe(true);
  });

  it('lists and revokes active invites for members who can manage members only', async () => {
    const { owner, project, member, outsider } = await setupTeam();
    const { body } = await owner
      .post(`/api/projects/${project.key}/invites`)
      .send({ roleId: roleId(project, 'member') })
      .expect(201);
    expect((await owner.get(`/api/projects/${project.key}/invites`).expect(200)).body.invites).toHaveLength(
      1,
    );
    await member.agent.get(`/api/projects/${project.key}/invites`).expect(403);
    await member.agent
      .post(`/api/projects/${project.key}/invites`)
      .send({ roleId: roleId(project, 'viewer') })
      .expect(403);
    await outsider.get(`/api/projects/${project.key}/invites`).expect(404);
    await owner.delete(`/api/projects/${project.key}/invites/${body.invite.id}`).expect(204);
    await agentFor()
      .get(`/api/auth/invites/${tokenOf(body.invite.url)}`)
      .expect(404);
    expect((await owner.get(`/api/projects/${project.key}/invites`).expect(200)).body.invites).toEqual([]);
  });

  it("doesn't let anyone invite into the owner role or a role above their own", async () => {
    const owner = agentFor();
    await registerUser(owner);
    const project = await createProject(owner);
    const { body } = await owner
      .post(`/api/projects/${project.key}/roles`)
      .send({ name: 'Recruiter', permissions: maskOf('project.manage_members', 'task.create') })
      .expect(201);
    const recruiter = agentFor();
    const account = await registerUser(recruiter);
    await addMember(owner, project.key, account.email, body.role.id);
    await recruiter
      .post(`/api/projects/${project.key}/invites`)
      .send({ roleId: roleId(project, 'admin') })
      .expect(403);
    await owner
      .post(`/api/projects/${project.key}/invites`)
      .send({ roleId: roleId(project, 'owner') })
      .expect(400);
  });

  it('creates app invites without a project', async () => {
    const inviter = agentFor();
    await registerUser(inviter);
    const { body } = await inviter
      .post('/api/invites')
      .send({ maxUses: null, expiresInDays: 30 })
      .expect(201);
    expect(body.invite).toMatchObject({ projectName: null, roleName: null, maxUses: null });
    const guest = agentFor();
    await registerUser(guest);
    expect((await guest.post(`/api/invites/${tokenOf(body.invite.url)}/accept`).expect(200)).body).toEqual({
      projectKey: null,
      joined: true,
    });
    await guest.post('/api/invites/not-a-real-token-but-long-enough/accept').expect(404);
  });
});
