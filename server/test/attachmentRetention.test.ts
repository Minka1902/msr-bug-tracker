import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { purgeDoneAttachments } from '../src/modules/attachments/service';
import { createTask, resetDb, setupTeam, statusOf, type Agent } from './helpers';

beforeEach(resetDb);

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

const upload = async (agent: Agent, taskId: string, ...files: string[]) => {
  const request = agent.post(`/api/tasks/${taskId}/attachments`);
  files.forEach((file) => request.attach('files', fixture(file)));
  return (await request.expect(201)).body.attachments as { id: string; url: string; name: string }[];
};

const storedPath = async (attachmentId: string) =>
  path.join(
    config.uploadDir,
    (await pool.query('SELECT storage_key FROM attachments WHERE id = $1', [attachmentId])).rows[0]
      .storage_key,
  );

const doneDaysAgo = (taskId: string, days: number) =>
  pool.query('UPDATE tasks SET completed_at = now() - make_interval(days => $2) WHERE id = $1', [
    taskId,
    days,
  ]);

const uploadedDaysAgo = (taskId: string, days: number) =>
  pool.query('UPDATE attachments SET created_at = now() - make_interval(days => $2) WHERE task_id = $1', [
    taskId,
    days,
  ]);

const liveCount = async (taskId: string) =>
  (
    await pool.query(
      `SELECT t.attachment_count,
              (SELECT count(*)::int FROM attachments a WHERE a.task_id = t.id AND a.purged_at IS NULL) AS live
       FROM tasks t WHERE t.id = $1`,
      [taskId],
    )
  ).rows[0] as { attachment_count: number; live: number };

const closedTeamTask = async () => {
  const team = await setupTeam();
  const task = await createTask(team.owner, team.project.key);
  const files = await upload(team.owner, task.id, 'red.png', 'notes.log');
  await team.owner
    .patch(`/api/tasks/${task.id}`)
    .send({ statusId: statusOf(team.project, 'task', 'Done') })
    .expect(200);
  return { ...team, task, files };
};

describe('attachment retention', () => {
  it('deletes the files of a card done for 7 days, and not sooner', async () => {
    const { owner, task, files } = await closedTeamTask();
    const [image, log] = files;
    const paths = [await storedPath(image!.id), await storedPath(log!.id)];
    await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ description: `Before: ![shot](${image!.url})` })
      .expect(200);

    await doneDaysAgo(task.id, 6);
    await uploadedDaysAgo(task.id, 6);
    await purgeDoneAttachments();
    expect(paths.map((file) => fs.existsSync(file))).toEqual([true, true]);
    expect(await liveCount(task.id)).toEqual({ attachment_count: 2, live: 2 });

    await doneDaysAgo(task.id, 8);
    await uploadedDaysAgo(task.id, 8);
    await purgeDoneAttachments();
    expect(paths.map((file) => fs.existsSync(file))).toEqual([false, false]);
    expect(await liveCount(task.id)).toEqual({ attachment_count: 0, live: 0 });

    const listed = (await owner.get(`/api/tasks/${task.id}/attachments`).expect(200)).body.attachments;
    expect(listed).toHaveLength(2);
    expect(listed.every((file: { purgedAt: string | null }) => file.purgedAt)).toBe(true);
    const placeholder = await owner.get(image!.url).buffer(true).expect(200);
    expect(placeholder.headers['content-type']).toMatch(/^image\/svg\+xml/);
    expect(String(placeholder.body)).toContain('Image deleted');
    expect((await owner.get(log!.url).expect(410)).body.error).toBe('Deleted 7 days after the card was done');
    expect((await owner.get(`/api/tasks/${task.id}`).expect(200)).body.task.description).toBe(
      `Before: ![shot](${image!.url})`,
    );

    await owner.delete(`/api/attachments/${log!.id}`).expect(204);
    expect(await liveCount(task.id)).toEqual({ attachment_count: 0, live: 0 });
  });

  it('keeps the files of a reopened card and of recent uploads on an old done card', async () => {
    const { owner, project, task } = await closedTeamTask();
    await owner.post(`/api/tasks/${task.id}/reopen`).expect(200);
    await uploadedDaysAgo(task.id, 30);

    const old = await createTask(owner, project.key, { statusId: statusOf(project, 'task', 'Done') });
    const [stale] = await upload(owner, old.id, 'red.png');
    await uploadedDaysAgo(old.id, 30);
    await doneDaysAgo(old.id, 30);
    const [fresh] = await upload(owner, old.id, 'notes.log');
    await pool.query("UPDATE attachments SET created_at = now() - interval '2 days' WHERE id = $1", [
      fresh!.id,
    ]);

    await purgeDoneAttachments();
    expect(await liveCount(task.id)).toEqual({ attachment_count: 2, live: 2 });
    expect(await liveCount(old.id)).toEqual({ attachment_count: 1, live: 1 });
    const listed = (await owner.get(`/api/tasks/${old.id}/attachments`).expect(200)).body.attachments;
    expect(listed.map((file: { id: string; purgedAt: string | null }) => [file.id, !!file.purgedAt])).toEqual(
      [
        [stale!.id, true],
        [fresh!.id, false],
      ],
    );
  });

  it('keeps a shared file while a copy of the card still uses it', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key);
    const [image] = await upload(owner, task.id, 'red.png');
    await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ description: `See ![shot](${image!.url})` })
      .expect(200);
    const file = await storedPath(image!.id);
    const copy = (await owner.post(`/api/tasks/${task.id}/duplicate`).expect(201)).body.task;
    await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ statusId: statusOf(project, 'task', 'Done') })
      .expect(200);

    await doneDaysAgo(task.id, 10);
    await uploadedDaysAgo(task.id, 10);
    await purgeDoneAttachments();
    expect(await liveCount(task.id)).toEqual({ attachment_count: 0, live: 0 });
    expect(fs.existsSync(file)).toBe(true);

    await owner.delete(`/api/tasks/${copy.id}`).expect(204);
    expect(fs.existsSync(file)).toBe(false);

    const duplicate = (await owner.post(`/api/tasks/${task.id}/duplicate`).expect(201)).body.task;
    const copied = (await owner.get(`/api/tasks/${duplicate.id}/attachments`).expect(200)).body.attachments;
    expect(copied).toEqual([expect.objectContaining({ name: 'red.png', purgedAt: expect.any(String) })]);
    expect(await liveCount(duplicate.id)).toEqual({ attachment_count: 0, live: 0 });
  });
});
