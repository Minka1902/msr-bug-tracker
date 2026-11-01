import { beforeEach, describe, expect, it } from 'vitest';
import { call, connect } from './mcpHelpers';
import { createTask, resetDb, setupTeam } from './helpers';

beforeEach(resetDb);

const START = 'Move a task to In Progress before you work on it.';
const FINISH = 'Create a task assigned to Michael for anything he needs to do.';

describe('project AI instructions', () => {
  it('are saved by people who can edit the project', async () => {
    const { owner, member, project } = await setupTeam();
    await member.agent
      .patch(`/api/projects/${project.key}`)
      .send({ aiInstructions: { start: START } })
      .expect(403);
    await owner
      .patch(`/api/projects/${project.key}`)
      .send({ aiInstructions: { start: 'x'.repeat(4001) } })
      .expect(400);
    await owner
      .patch(`/api/projects/${project.key}`)
      .send({ aiInstructions: { start: `  ${START}  `, finish: FINISH } })
      .expect(200);
    await owner.patch(`/api/projects/${project.key}`).send({ name: 'Renamed' }).expect(200);
    const { body } = await member.agent.get(`/api/projects/${project.key}`).expect(200);
    expect(body.project.aiInstructions).toEqual({ start: START, finish: FINISH });
  });

  it('come first and last in every tool answer about the project', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key, { title: 'Write the docs' });
    const { tokens } = await connect(owner);
    const token = tokens.access_token;

    const plain = await call(token, 'fetch', { id: task.identifier });
    expect(plain.blocks).toHaveLength(1);

    await owner
      .patch(`/api/projects/${project.key}`)
      .send({ aiInstructions: { start: START, finish: FINISH } })
      .expect(200);

    for (const [tool, args] of [
      ['fetch', { id: task.identifier }],
      ['fetch', { id: project.key }],
      ['list_tasks', { projectKey: project.key }],
      ['my_tasks', {}],
      ['update_task', { id: task.identifier, priority: 'high' }],
      ['add_comment', { id: task.identifier, body: 'Started' }],
    ] as const) {
      if (tool === 'my_tasks')
        await owner.patch(`/api/tasks/${task.id}`).send({ assigneeId: task.reporterId }).expect(200);
      const answer = await call(token, tool, args);
      expect(answer.isError, tool).toBe(false);
      expect(answer.blocks, tool).toEqual([
        `WEB instructions, before you start:\n${START}`,
        answer.text,
        `WEB instructions, when you finish:\n${FINISH}`,
      ]);
    }

    expect((await call(token, 'list_projects', {})).blocks).toHaveLength(1);
    const failed = await call(token, 'update_task', { id: 'WEB-99', priority: 'high' });
    expect(failed).toMatchObject({ isError: true, blocks: ['Task not found'] });
  });

  it('leave out a side that is empty', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key);
    await owner
      .patch(`/api/projects/${project.key}`)
      .send({ aiInstructions: { finish: FINISH } })
      .expect(200);
    const { tokens } = await connect(owner);
    const answer = await call(tokens.access_token, 'fetch', { id: task.identifier });
    expect(answer.blocks).toEqual([answer.text, `WEB instructions, when you finish:\n${FINISH}`]);
  });
});
