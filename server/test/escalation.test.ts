import { escalatedPriority } from '@msr/shared/escalation';
import type { EscalationRange, TaskEscalation } from '@msr/shared/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { escalatePriorities } from '../src/modules/tasks/escalation';
import { createTask, resetDb, setupTeam, statusOf, type Agent } from './helpers';

beforeEach(resetDb);

const RANGE = { from: 'low', to: 'urgent' } as const;

interface ScheduledTask {
  id: string;
  title: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  escalation: TaskEscalation | null;
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const schedule = async (agent: Agent, body: Record<string, unknown>) =>
  (await createTask(agent, 'WEB', body)) as unknown as ScheduledTask;

const getTask = async (agent: Agent, id: string) =>
  (await agent.get(`/api/tasks/${id}`).expect(200)).body.task as ScheduledTask;

const patchTask = async (agent: Agent, id: string, body: Record<string, unknown>) =>
  (await agent.patch(`/api/tasks/${id}`).send(body).expect(200)).body.task as ScheduledTask;

const activity = async (agent: Agent, id: string) =>
  (await agent.get(`/api/tasks/${id}/activity`).expect(200)).body.activity as {
    action: string;
    field: string | null;
    oldValue: unknown;
    newValue: unknown;
    actor: unknown;
  }[];

const shiftDates = (id: string, start: number, due: number) =>
  pool.query('UPDATE tasks SET start_date = $2, due_date = $3 WHERE id = $1', [id, day(start), day(due)]);

describe('priority schedule', () => {
  it('starts on the day the schedule is set, not on the creation day', async () => {
    const { owner } = await setupTeam();
    const task = await schedule(owner, { dueDate: day(9) });
    await pool.query("UPDATE tasks SET created_at = now() - interval '30 days' WHERE id = $1", [task.id]);
    expect(await patchTask(owner, task.id, { escalation: RANGE })).toMatchObject({
      priority: 'low',
      escalation: { ...RANGE, since: day(0) },
    });
  });

  it('picks the current step from the start date without logging it on create', async () => {
    const { owner } = await setupTeam();
    const task = await schedule(owner, { startDate: day(-5), dueDate: day(4), escalation: RANGE });
    expect(task.priority).toBe('high');
    expect((await activity(owner, task.id)).map((entry) => entry.action)).toEqual(['created']);
  });

  it('jumps to the end priority once the due date has passed', async () => {
    const { owner } = await setupTeam();
    const task = await schedule(owner, { dueDate: day(-1), escalation: { from: 'low', to: 'high' } });
    expect(task.priority).toBe('high');
  });

  it('reaches the end priority on a one-day window', async () => {
    const { owner } = await setupTeam();
    const task = await schedule(owner, { startDate: day(0), dueDate: day(0), escalation: RANGE });
    expect(task.priority).toBe('urgent');
  });

  it('raises the priority as days pass and logs it without an actor', async () => {
    const { owner } = await setupTeam();
    const task = await schedule(owner, { startDate: day(0), dueDate: day(9), escalation: RANGE });
    expect(task.priority).toBe('low');
    await shiftDates(task.id, -7, 2);
    await escalatePriorities(null, true);
    expect((await getTask(owner, task.id)).priority).toBe('urgent');
    expect((await activity(owner, task.id)).at(-1)).toMatchObject({
      action: 'escalated',
      field: 'priority',
      oldValue: 'low',
      newValue: 'urgent',
      actor: null,
    });
  });

  it('turns the schedule off when the priority is changed by hand', async () => {
    const { owner } = await setupTeam();
    const task = await schedule(owner, { startDate: day(0), dueDate: day(9), escalation: RANGE });
    expect(await patchTask(owner, task.id, { priority: 'medium' })).toMatchObject({
      priority: 'medium',
      escalation: null,
    });
    await shiftDates(task.id, -7, 2);
    await escalatePriorities(null, true);
    expect((await getTask(owner, task.id)).priority).toBe('medium');
    expect(await activity(owner, task.id)).toContainEqual(
      expect.objectContaining({ field: 'escalation', oldValue: 'Low → Urgent', newValue: null }),
    );
  });

  it('turns the schedule off when the priority is changed in bulk', async () => {
    const { owner } = await setupTeam();
    const first = await schedule(owner, { dueDate: day(9), escalation: RANGE });
    const second = await schedule(owner, { dueDate: day(9), escalation: { from: 'medium', to: 'high' } });
    await owner
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids: [first.id, second.id], patch: { priority: 'high' } })
      .expect(200);
    for (const id of [first.id, second.id])
      expect(await getTask(owner, id)).toMatchObject({ priority: 'high', escalation: null });
  });

  it('needs a due date and turns off when the due date is cleared', async () => {
    const { owner } = await setupTeam();
    await owner.post('/api/projects/WEB/tasks').send({ title: 'No date', escalation: RANGE }).expect(400);
    const undated = await schedule(owner, { title: 'Undated' });
    const refused = await owner.patch(`/api/tasks/${undated.id}`).send({ escalation: RANGE }).expect(400);
    expect(refused.body.error).toBe('Set a due date to schedule the priority');
    const task = await schedule(owner, { dueDate: day(9), escalation: RANGE });
    expect(await patchTask(owner, task.id, { dueDate: null })).toMatchObject({ escalation: null });
  });

  it('leaves done tasks alone and recomputes when they are reopened', async () => {
    const { owner, project } = await setupTeam();
    const task = await schedule(owner, { startDate: day(0), dueDate: day(9), escalation: RANGE });
    await patchTask(owner, task.id, { statusId: statusOf(project, 'task', 'Done') });
    await shiftDates(task.id, -7, 2);
    await escalatePriorities(null, true);
    expect((await getTask(owner, task.id)).priority).toBe('low');
    const reopened = (await owner.post(`/api/tasks/${task.id}/reopen`).expect(200)).body
      .task as ScheduledTask;
    expect(reopened.priority).toBe('urgent');
  });

  it('keeps the schedule on duplicates and restarts it on recurring copies', async () => {
    const { owner, project } = await setupTeam();
    const task = await schedule(owner, {
      title: 'Weekly report',
      startDate: day(-5),
      dueDate: day(4),
      escalation: RANGE,
      recurrence: { freq: 'weekly', interval: 1 },
    });
    const copy = (await owner.post(`/api/tasks/${task.id}/duplicate`).expect(201)).body.task as ScheduledTask;
    expect(copy).toMatchObject({ priority: 'high', escalation: task.escalation });

    await patchTask(owner, task.id, { statusId: statusOf(project, 'task', 'Done') });
    const { body } = await owner.get('/api/projects/WEB/tasks?q=Weekly').expect(200);
    const spawned = (body.items as ScheduledTask[]).find(
      (item) => item.id !== task.id && item.id !== copy.id && item.title === 'Weekly report',
    )!;
    expect(spawned.escalation).toEqual({ ...RANGE, since: day(0) });
    expect(spawned.priority).toBe(
      escalatedPriority(RANGE, spawned.startDate ?? day(0), spawned.dueDate!, day(0)),
    );
  });

  it('matches the shared formula for every window and direction', async () => {
    const { owner } = await setupTeam();
    const windows = [
      [0, 0],
      [0, 1],
      [-1, 1],
      [-3, 9],
      [-9, 9],
      [-20, 3],
      [2, 5],
    ] as const;
    const ranges: EscalationRange[] = [RANGE, { from: 'urgent', to: 'low' }, { from: 'medium', to: 'high' }];
    for (const [start, due] of windows)
      for (const range of ranges) {
        const task = await schedule(owner, { startDate: day(start), dueDate: day(due), escalation: range });
        expect({ start, due, range, priority: task.priority }).toEqual({
          start,
          due,
          range,
          priority: escalatedPriority(range, day(start), day(due), day(0)),
        });
      }
  });
});
