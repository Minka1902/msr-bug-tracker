import path from 'node:path';
import { maskOf } from '@msr/shared/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { createProject, createTask, resetDb, setupTeam, type Agent } from './helpers';

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

beforeEach(resetDb);

const counters = async (taskId: string) =>
  (
    await pool.query(
      `SELECT t.comment_count, t.attachment_count, t.checklist_total, t.checklist_done,
              (SELECT count(*)::int FROM task_comments c WHERE c.task_id = t.id) AS comments,
              (SELECT count(*)::int FROM attachments a WHERE a.task_id = t.id) AS attachments,
              (SELECT count(*)::int FROM task_checklist_items i WHERE i.task_id = t.id) AS items,
              (SELECT count(*)::int FROM task_checklist_items i WHERE i.task_id = t.id AND i.is_done) AS done
       FROM tasks t WHERE t.id = $1`,
      [taskId],
    )
  ).rows[0];

const expectCountersConsistent = async (taskId: string) => {
  const row = await counters(taskId);
  expect([row.comment_count, row.attachment_count, row.checklist_total, row.checklist_done]).toEqual([
    row.comments,
    row.attachments,
    row.items,
    row.done,
  ]);
  return row;
};

const upload = (agent: Agent, url: string, ...files: string[]) => {
  const request = agent.post(url);
  files.forEach((file) => request.attach('files', fixture(file)));
  return request;
};

describe('attachments', () => {
  it('uploads to a task, serves it to members only, and deletes', async () => {
    const { owner, project, outsider, member } = await setupTeam();
    const task = await createTask(owner, project.key);
    const { body } = await upload(owner, `/api/tasks/${task.id}/attachments`, 'red.png', 'notes.log').expect(
      201,
    );
    expect(body.attachments.map((file: { mime: string }) => file.mime)).toEqual(['image/png', 'text/plain']);
    const [image, log] = body.attachments;
    const served = await owner.get(image.url).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect((await owner.get(log.url).expect(200)).headers['content-disposition']).toMatch(/^attachment/);
    await outsider.get(image.url).expect(404);
    expect((await owner.get(`/api/tasks/${task.id}`)).body.task.coverUrl).toBe(image.url);
    await member.agent.delete(`/api/attachments/${image.id}`).expect(403);
    await owner.delete(`/api/attachments/${image.id}`).expect(204);
    await owner.get(image.url).expect(404);
    expect((await expectCountersConsistent(task.id)).attachment_count).toBe(1);
  });

  it('keeps non-ASCII file names intact', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key);
    const { body } = await upload(owner, `/api/tasks/${task.id}/attachments`, 'דוח-日本.log').expect(201);
    expect(body.attachments[0].name).toBe('דוח-日本.log');
  });

  it('rejects disallowed types and requires attachment.upload', async () => {
    const { owner, project, viewer } = await setupTeam();
    const task = await createTask(owner, project.key);
    await upload(owner, `/api/tasks/${task.id}/attachments`, 'evil.svg').expect(415);
    await upload(owner, `/api/tasks/${task.id}/attachments`, 'fake.png').expect(415);
    await upload(viewer.agent, `/api/tasks/${task.id}/attachments`, 'red.png').expect(403);
    await expectCountersConsistent(task.id);
  });

  it('links pending uploads only for their uploader when a task is created', async () => {
    const { owner, project, member } = await setupTeam();
    const mine = (await upload(owner, '/api/attachments', 'red.png').expect(201)).body.attachments[0];
    const theirs = (await upload(member.agent, '/api/attachments', 'red.png').expect(201)).body
      .attachments[0];
    await member.agent.get(mine.url).expect(404);
    const task = await createTask(owner, project.key, { attachmentIds: [mine.id, theirs.id] });
    const { body } = await owner.get(`/api/tasks/${task.id}/attachments`).expect(200);
    expect(body.attachments.map((file: { id: string }) => file.id)).toEqual([mine.id]);
    await member.agent.get(mine.url).expect(200);
    await expectCountersConsistent(task.id);
  });
});

describe('comments', () => {
  it('threads one level, keeps counters, and enforces authorship', async () => {
    const { owner, project, member, admin, viewer } = await setupTeam();
    const task = await createTask(owner, project.key);
    const root = (
      await member.agent
        .post(`/api/tasks/${task.id}/comments`)
        .send({ body: 'Looks broken on iOS' })
        .expect(201)
    ).body.comment;
    const reply = (
      await owner
        .post(`/api/tasks/${task.id}/comments`)
        .send({ body: 'Fixing', parentId: root.id })
        .expect(201)
    ).body.comment;
    await owner
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: 'Nested', parentId: reply.id })
      .expect(400);
    await viewer.agent.post(`/api/tasks/${task.id}/comments`).send({ body: 'hi' }).expect(403);
    await owner.patch(`/api/comments/${root.id}`).send({ body: 'edited by owner' }).expect(200);
    await viewer.agent.patch(`/api/comments/${root.id}`).send({ body: 'edit' }).expect(403);
    const edited = await member.agent
      .patch(`/api/comments/${root.id}`)
      .send({ body: 'Broken on iOS 18' })
      .expect(200);
    expect(edited.body.comment.editedAt).not.toBeNull();
    const { body } = await viewer.agent.get(`/api/tasks/${task.id}/comments`).expect(200);
    expect(
      body.comments.map((comment: { id: string; parentId: string | null }) => [comment.id, comment.parentId]),
    ).toEqual([
      [root.id, null],
      [reply.id, root.id],
    ]);
    expect((await expectCountersConsistent(task.id)).comment_count).toBe(2);
    await admin.agent.delete(`/api/comments/${root.id}`).expect(204);
    expect((await expectCountersConsistent(task.id)).comment_count).toBe(0);
  });

  it('attaches pasted images to the comment and the task', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key);
    const image = (await upload(owner, '/api/attachments', 'red.png')).body.attachments[0];
    const { body } = await owner
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: `![shot](${image.url})`, attachmentIds: [image.id] })
      .expect(201);
    const files = (await owner.get(`/api/tasks/${task.id}/attachments`)).body.attachments;
    expect(files).toEqual([expect.objectContaining({ id: image.id, commentId: body.comment.id })]);
    await expectCountersConsistent(task.id);
  });
});

describe('checklists', () => {
  it('adds, checks, reorders and removes items with counters', async () => {
    const { owner, project, viewer } = await setupTeam();
    const task = await createTask(owner, project.key);
    const first = (
      await owner.post(`/api/tasks/${task.id}/checklist`).send({ text: 'Write tests' }).expect(201)
    ).body.item;
    const second = (await owner.post(`/api/tasks/${task.id}/checklist`).send({ text: 'Ship it' }).expect(201))
      .body.item;
    expect(second.position > first.position).toBe(true);
    await viewer.agent.post(`/api/tasks/${task.id}/checklist`).send({ text: 'x' }).expect(403);
    await owner.patch(`/api/checklist/${first.id}`).send({ isDone: true }).expect(200);
    await owner.patch(`/api/checklist/${second.id}`).send({ position: 'Zz' }).expect(200);
    const { body } = await owner.get(`/api/tasks/${task.id}/checklist`).expect(200);
    expect(body.items.map((item: { text: string }) => item.text)).toEqual(['Ship it', 'Write tests']);
    expect((await expectCountersConsistent(task.id)).checklist_done).toBe(1);
    await owner.delete(`/api/checklist/${first.id}`).expect(204);
    const row = await expectCountersConsistent(task.id);
    expect([row.checklist_total, row.checklist_done]).toEqual([1, 0]);
  });

  it('is copied unchecked when duplicating', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key);
    const item = (await owner.post(`/api/tasks/${task.id}/checklist`).send({ text: 'Step' })).body.item;
    await owner.patch(`/api/checklist/${item.id}`).send({ isDone: true });
    const copy = (await owner.post(`/api/tasks/${task.id}/duplicate`).expect(201)).body.task;
    const row = await expectCountersConsistent(copy.id);
    expect([row.checklist_total, row.checklist_done]).toEqual([1, 0]);
  });
});

describe('relations', () => {
  it('links tasks across projects the user can see and lists both directions', async () => {
    const { owner, project, outsider } = await setupTeam();
    const other = await createProject(owner, { key: 'APP', name: 'App' });
    const bug = await createTask(owner, project.key, { type: 'bug', title: 'Crash' });
    const duplicate = await createTask(owner, project.key, { type: 'bug', title: 'Crash again' });
    const related = await createTask(owner, other.key, { title: 'API change' });
    const foreign = await createProject(outsider, { key: 'OTH' });
    await createTask(outsider, foreign.key);
    const link = (
      await owner
        .post(`/api/tasks/${duplicate.id}/relations`)
        .send({ target: bug.identifier, type: 'duplicates' })
        .expect(201)
    ).body.relation;
    await owner.post(`/api/tasks/${bug.id}/relations`).send({ target: 'APP-1', type: 'relates' }).expect(201);
    await owner
      .post(`/api/tasks/${related.id}/relations`)
      .send({ target: bug.identifier, type: 'relates' })
      .expect(409);
    await owner
      .post(`/api/tasks/${bug.id}/relations`)
      .send({ target: bug.identifier, type: 'relates' })
      .expect(400);
    await owner.post(`/api/tasks/${bug.id}/relations`).send({ target: 'OTH-1', type: 'relates' }).expect(404);
    const { body } = await owner.get(`/api/tasks/${bug.id}/relations`).expect(200);
    expect(
      body.relations
        .map((relation: { type: string; direction: string; task: { identifier: string } }) => [
          relation.type,
          relation.direction,
          relation.task.identifier,
        ])
        .sort(),
    ).toEqual([
      ['duplicates', 'incoming', duplicate.identifier],
      ['relates', 'outgoing', 'APP-1'],
    ]);
    await owner.delete(`/api/relations/${link.id}`).expect(204);
    expect((await owner.get(`/api/tasks/${bug.id}/relations`)).body.relations).toHaveLength(1);
  });

  it('requires edit rights on the source task', async () => {
    const { owner, project, member } = await setupTeam();
    const own = (
      await owner
        .post('/api/projects/WEB/roles')
        .send({ name: 'Reporter', permissions: maskOf('task.create', 'task.edit_own') })
    ).body.role.id;
    await owner.patch(`/api/projects/WEB/members/${member.id}`).send({ roleId: own });
    const theirs = await createTask(owner, project.key);
    const mine = await createTask(member.agent, project.key);
    await member.agent
      .post(`/api/tasks/${theirs.id}/relations`)
      .send({ target: mine.identifier, type: 'relates' })
      .expect(403);
    await member.agent
      .post(`/api/tasks/${mine.id}/relations`)
      .send({ target: theirs.identifier, type: 'relates' })
      .expect(201);
  });
});
