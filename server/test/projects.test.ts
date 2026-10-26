import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@msr/shared/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { agentFor, createProject, projectInput, registerUser, resetDb, setupTeam } from './helpers';

beforeEach(resetDb);

describe('creating projects', () => {
  it('creates roles, owner membership and both default workflows', async () => {
    const agent = agentFor();
    const { user } = await registerUser(agent);
    const project = await createProject(agent, { key: 'web' });
    expect(project.key).toBe('WEB');
    expect(project.permissions).toBe(ALL_PERMISSIONS);
    expect(project.roles.map((role) => role.systemKey)).toEqual(['owner', 'admin', 'member', 'viewer']);
    expect(project.roles.find((role) => role.systemKey === 'member')!.permissions).toBe(
      DEFAULT_ROLE_PERMISSIONS.member,
    );
    expect(project.memberList).toEqual([expect.objectContaining({ id: user.id, isOwner: true })]);
    const byWorkflow = (workflow: string) =>
      project.statuses.filter((status) => status.workflow === workflow).map((status) => status.name);
    expect(byWorkflow('task')).toEqual(['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']);
    expect(byWorkflow('bug')).toEqual(['Open', 'In Progress', 'Ready for QA', 'Resolved', 'Closed']);
  });

  it('validates keys and keeps them globally unique', async () => {
    const first = agentFor();
    await registerUser(first);
    await createProject(first, { key: 'WEB' });
    const second = agentFor();
    await registerUser(second);
    await second
      .post('/api/projects')
      .send(projectInput({ key: 'web' }))
      .expect(409);
    await second
      .post('/api/projects')
      .send(projectInput({ key: '1AB' }))
      .expect(400);
    await second
      .post('/api/projects')
      .send(projectInput({ key: 'TOOLONGKEY' }))
      .expect(400);
    const { body } = await second.get('/api/projects/key-available').query({ key: 'web' }).expect(200);
    expect(body).toEqual({ key: 'WEB', available: false, suggestion: 'WEB2' });
    expect((await second.get('/api/projects/key-available').query({ key: 'APP' })).body.available).toBe(true);
  });

  it('never changes the key after creation', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await createProject(agent);
    await agent.patch('/api/projects/WEB').send({ key: 'NEW' }).expect(400);
  });
});

describe('listing and access', () => {
  it('lists only projects the user belongs to, with stats', async () => {
    const mine = agentFor();
    await registerUser(mine);
    await createProject(mine, { key: 'MINE', name: 'Mine' });
    const other = agentFor();
    await registerUser(other);
    await createProject(other, { key: 'THEIRS', name: 'Theirs' });
    const { body } = await mine.get('/api/projects').expect(200);
    expect(body.projects.map((project: { key: string }) => project.key)).toEqual(['MINE']);
    expect(body.projects[0]).toMatchObject({
      isOwner: true,
      roleName: 'Owner',
      memberCount: 1,
      stats: { total: 0, completed: 0, active: 0, overdue: 0, progress: 0 },
    });
  });

  it('hides other users projects behind 404', async () => {
    const { project, outsider } = await setupTeam();
    await outsider.get(`/api/projects/${project.key}`).expect(404);
    await outsider.patch(`/api/projects/${project.key}`).send({ name: 'Hacked' }).expect(404);
    await outsider.delete(`/api/projects/${project.key}`).expect(404);
  });

  it('shows members their role and permissions', async () => {
    const { project, member } = await setupTeam();
    const { body } = await member.agent.get(`/api/projects/${project.key}`).expect(200);
    expect(body.project).toMatchObject({
      isOwner: false,
      roleName: 'Member',
      permissions: DEFAULT_ROLE_PERMISSIONS.member,
    });
    expect(body.project.memberList).toHaveLength(4);
  });
});

describe('project links', () => {
  it('stores live and repository URLs, clears them, and rejects other schemes', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const project = await createProject(agent, {
      liveUrl: 'https://app.example.com',
      repoUrl: 'https://github.com/team/web',
    });
    expect(project).toMatchObject({
      liveUrl: 'https://app.example.com',
      repoUrl: 'https://github.com/team/web',
    });
    const { body } = await agent.patch('/api/projects/WEB').send({ liveUrl: '' }).expect(200);
    expect(body.project).toMatchObject({ liveUrl: null, repoUrl: 'https://github.com/team/web' });
    await agent.patch('/api/projects/WEB').send({ repoUrl: 'javascript:alert(1)' }).expect(400);
    await agent.patch('/api/projects/WEB').send({ liveUrl: 'ftp://files.example.com' }).expect(400);
    await agent
      .post('/api/projects')
      .send(projectInput({ key: 'APP', liveUrl: 'example.com' }))
      .expect(400);
  });
});

describe('editing projects', () => {
  it('requires project.edit', async () => {
    const { project, admin, member } = await setupTeam();
    const denied = await member.agent
      .patch(`/api/projects/${project.key}`)
      .send({ name: 'Nope' })
      .expect(403);
    expect(denied.body.details.missing).toEqual(['project.edit']);
    const { body } = await admin.agent
      .patch(`/api/projects/${project.key}`)
      .send({ name: 'Renamed', color: '#22c55e' })
      .expect(200);
    expect(body.project).toMatchObject({ name: 'Renamed', color: '#22c55e' });
  });

  it('keeps favorites per user', async () => {
    const { owner, project, member } = await setupTeam();
    await member.agent.put(`/api/projects/${project.key}/favorite`).send({ favorite: true }).expect(204);
    expect((await member.agent.get('/api/projects')).body.projects[0].isFavorite).toBe(true);
    expect((await owner.get('/api/projects')).body.projects[0].isFavorite).toBe(false);
  });

  it('archives, blocks edits while archived, and restores', async () => {
    const { owner, project, member } = await setupTeam();
    await member.agent.post(`/api/projects/${project.key}/archive`).expect(403);
    await owner.post(`/api/projects/${project.key}/archive`).expect(200);
    expect((await owner.get('/api/projects')).body.projects).toHaveLength(0);
    expect((await owner.get('/api/projects').query({ archived: 'true' })).body.projects[0].isArchived).toBe(
      true,
    );
    await owner.patch(`/api/projects/${project.key}`).send({ name: 'Edit' }).expect(409);
    await owner.post(`/api/projects/${project.key}/restore`).expect(200);
    await owner.patch(`/api/projects/${project.key}`).send({ name: 'Edit' }).expect(200);
  });

  it('lets only the owner delete', async () => {
    const { owner, project, admin } = await setupTeam();
    await admin.agent.delete(`/api/projects/${project.key}`).expect(403);
    await owner.delete(`/api/projects/${project.key}`).expect(204);
    await owner.get(`/api/projects/${project.key}`).expect(404);
    expect((await admin.agent.get('/api/projects')).body.projects).toHaveLength(0);
  });
});
