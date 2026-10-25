import { beforeEach, describe, expect, it } from 'vitest';
import { agentFor, createProject, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

const setup = async () => {
  const agent = agentFor();
  await registerUser(agent);
  const project = await createProject(agent);
  const status = (workflow: string, name: string) =>
    project.statuses.find((item) => item.workflow === workflow && item.name === name)!;
  return { agent, project, status };
};

describe('workflow statuses', () => {
  it('appends new statuses and reorders by position', async () => {
    const { agent, status } = await setup();
    const { body } = await agent
      .post('/api/projects/WEB/statuses')
      .send({ workflow: 'task', name: 'Blocked', color: '#ef4444', category: 'in_progress' })
      .expect(201);
    expect(body.status.position > status('task', 'Done').position).toBe(true);
    await agent
      .post('/api/projects/WEB/statuses')
      .send({ workflow: 'task', name: 'blocked', color: '#ef4444', category: 'todo' })
      .expect(409);
    const before = status('task', 'Backlog').position;
    await agent.patch(`/api/projects/WEB/statuses/${body.status.id}`).send({ position: 'Zz' }).expect(200);
    expect('Zz' < before).toBe(true);
    const detail = (await agent.get('/api/projects/WEB')).body.project;
    expect(detail.statuses.filter((item: { workflow: string }) => item.workflow === 'task')[0].name).toBe(
      'Blocked',
    );
  });

  it('keeps at least one open and one done status per workflow', async () => {
    const { agent, status } = await setup();
    await agent
      .delete(`/api/projects/WEB/statuses/${status('bug', 'Resolved').id}`)
      .send({ moveTo: status('bug', 'Closed').id })
      .expect(204);
    await agent
      .delete(`/api/projects/WEB/statuses/${status('bug', 'Closed').id}`)
      .send({ moveTo: status('bug', 'Open').id })
      .expect(400);
    await agent
      .patch(`/api/projects/WEB/statuses/${status('bug', 'Closed').id}`)
      .send({ category: 'in_progress' })
      .expect(400);
    await agent
      .patch(`/api/projects/WEB/statuses/${status('bug', 'Open').id}`)
      .send({ category: 'in_progress' })
      .expect(400);
  });

  it('only moves tasks into a status of the same workflow', async () => {
    const { agent, status } = await setup();
    await agent
      .delete(`/api/projects/WEB/statuses/${status('task', 'In Review').id}`)
      .send({ moveTo: status('bug', 'Open').id })
      .expect(400);
    await agent
      .delete(`/api/projects/WEB/statuses/${status('task', 'In Review').id}`)
      .send({ moveTo: status('task', 'In Review').id })
      .expect(400);
  });
});

describe('labels', () => {
  it('creates, renames and deletes labels with case-insensitive names', async () => {
    const { agent } = await setup();
    const { body } = await agent
      .post('/api/projects/WEB/labels')
      .send({ name: 'Frontend', color: '#3b82f6' })
      .expect(201);
    await agent.post('/api/projects/WEB/labels').send({ name: 'frontend', color: '#3b82f6' }).expect(409);
    const renamed = await agent
      .patch(`/api/projects/WEB/labels/${body.label.id}`)
      .send({ name: 'UI' })
      .expect(200);
    expect(renamed.body.label).toMatchObject({ name: 'UI', color: '#3b82f6' });
    await agent.delete(`/api/projects/WEB/labels/${body.label.id}`).expect(204);
    expect((await agent.get('/api/projects/WEB')).body.project.labels).toEqual([]);
  });
});
