import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { agentFor, createProject, registerUser, resetDb, setupTeam, type Agent } from './helpers';

beforeEach(resetDb);

const csv = (rows: string[][]) =>
  Buffer.from(rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n'));

const upload = (
  agent: Agent,
  key: string,
  file: Buffer,
  name: string,
  fields: Record<string, string> = {},
) => {
  const request = agent.post(`/api/projects/${key}/tasks/import`).attach('file', file, name);
  Object.entries(fields).forEach(([field, value]) => request.field(field, value));
  return request;
};

const SAMPLE = csv([
  ['Title', 'Type', 'Status', 'Priority', 'Assignee email', 'Labels', 'Due date', 'ID', 'Parent ID'],
  ['Checkout is broken', 'bug', 'In Progress', 'urgent', '', 'checkout, safari', '2026-11-05', '1', ''],
  ['Write tests for checkout', 'task', 'Ready for QA', 'high', 'ghost@nowhere.dev', 'checkout', '', '2', '1'],
  ['Ship the fix', 'task', 'Done', 'low', '', '', '11/20/2026', '3', ''],
  ['', 'task', '', '', '', '', '', '4', ''],
]);

describe('task import', () => {
  it('serves CSV and Excel templates', async () => {
    const owner = agentFor();
    await registerUser(owner);
    const csvTemplate = await owner.get('/api/import/template?format=csv').expect(200);
    expect(csvTemplate.headers['content-disposition']).toContain('msr-import-template.csv');
    expect(csvTemplate.text).toMatch(/^\uFEFFTitle,Type,Status,Priority/);
    const xlsx = await owner.get('/api/import/template?format=xlsx').responseType('blob').expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Tasks', 'Instructions']);
    expect(workbook.getWorksheet('Tasks')!.getCell('B2').dataValidation.formulae).toEqual([
      '"task,bug,feature,improvement,chore,errand"',
    ]);
  });

  it('previews without writing and reports skipped rows and guesses', async () => {
    const { owner, project } = await setupTeam();
    const { body } = await upload(owner, project.key, SAMPLE, 'tasks.csv').expect(200);
    expect(body).toMatchObject({ total: 4, valid: 3, missingTitle: false });
    expect(body.skipped).toEqual([{ row: 5, message: 'Title is missing' }]);
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        'Status "Ready for QA" doesn\'t exist here, used "In Progress"',
        "ghost@nowhere.dev isn't a project member, left unassigned",
      ]),
    );
    expect(body.sample[0]).toMatchObject({ title: 'Checkout is broken', type: 'bug', status: 'In Progress' });
    expect((await pool.query('SELECT count(*)::int AS n FROM tasks')).rows[0].n).toBe(0);
  });

  it('imports tasks with labels, subtasks, numbers and counters, then exports them back', async () => {
    const { owner, project } = await setupTeam();
    const { body } = await upload(owner, project.key, SAMPLE, 'tasks.csv', { mode: 'commit' }).expect(201);
    expect(body).toMatchObject({ created: 3 });
    expect(body.warnings).toContain('Created labels: checkout, safari');
    const { rows } = await pool.query(
      `SELECT t.number, t.title, t.type, s.category, t.completed_at IS NOT NULL AS done, t.due_date::text,
              t.subtask_total, p.number AS parent
       FROM tasks t JOIN project_statuses s ON s.id = t.status_id LEFT JOIN tasks p ON p.id = t.parent_id
       ORDER BY t.number`,
    );
    expect(rows).toEqual([
      {
        number: 1,
        title: 'Checkout is broken',
        type: 'bug',
        category: 'in_progress',
        done: false,
        due_date: '2026-11-05',
        subtask_total: 1,
        parent: null,
      },
      {
        number: 2,
        title: 'Write tests for checkout',
        type: 'task',
        category: 'in_progress',
        done: false,
        due_date: null,
        subtask_total: 0,
        parent: 1,
      },
      {
        number: 3,
        title: 'Ship the fix',
        type: 'task',
        category: 'done',
        done: true,
        due_date: '2026-11-20',
        subtask_total: 0,
        parent: null,
      },
    ]);

    const exported = await owner.get(`/api/projects/${project.key}/tasks/export?format=csv`).expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    const lines = exported.text.trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('WEB-2');
    expect(lines[2]).toContain(',WEB-1,');

    const second = await createProject(owner, { key: 'COPY', name: 'Copy' });
    const again = await upload(owner, second.key, Buffer.from(exported.text), 'export.csv', {
      mode: 'commit',
    }).expect(201);
    expect(again.body.created).toBe(3);
    const copied = await pool.query(
      `SELECT c.title FROM tasks c JOIN tasks p ON p.id = c.parent_id JOIN projects pr ON pr.id = c.project_id WHERE pr.key = 'COPY'`,
    );
    expect(copied.rows).toEqual([{ title: 'Write tests for checkout' }]);
  });

  it('reads Excel files, including real date cells, and exports Excel', async () => {
    const { owner, project } = await setupTeam();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tasks');
    sheet.addRow(['Title', 'Due date', 'Priority']);
    sheet.addRow(['From Excel', new Date(Date.UTC(2026, 11, 24)), 'High']);
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    await upload(owner, project.key, file, 'tasks.xlsx', { mode: 'commit' }).expect(201);
    const { rows } = await pool.query('SELECT title, priority, due_date::text FROM tasks');
    expect(rows).toEqual([{ title: 'From Excel', priority: 'high', due_date: '2026-12-24' }]);
    const xlsx = await owner
      .get(`/api/projects/${project.key}/tasks/export?format=xlsx`)
      .responseType('blob')
      .expect(200);
    const read = new ExcelJS.Workbook();
    await read.xlsx.load(xlsx.body);
    expect(read.worksheets[0]!.getRow(2).getCell(2).value).toBe('From Excel');
  });

  it('recognises ClickUp exports and lets the user remap columns', async () => {
    const { owner, project } = await setupTeam();
    const clickup = csv([
      ['Task ID', 'Task Name', 'Status', 'Priority', 'Assignees', 'Tags', 'Due Date'],
      [
        '86abc',
        'Imported from ClickUp',
        'complete',
        'normal',
        '[]',
        '[backend]',
        String(Date.UTC(2026, 10, 3)),
      ],
    ]);
    const preview = await upload(owner, project.key, clickup, 'clickup.csv').expect(200);
    expect(preview.body.mapping).toMatchObject({
      'Task ID': 'externalId',
      'Task Name': 'title',
      Tags: 'labels',
    });
    expect(preview.body.sample[0]).toMatchObject({
      status: 'Done',
      priority: 'medium',
      labels: ['backend'],
      dueDate: '2026-11-03',
    });

    const odd = csv([
      ['Thing', 'When'],
      ['Mapped by hand', '2026-01-02'],
    ]);
    expect((await upload(owner, project.key, odd, 'odd.csv').expect(200)).body.missingTitle).toBe(true);
    await upload(owner, project.key, odd, 'odd.csv', { mode: 'commit' }).expect(400);
    await upload(owner, project.key, odd, 'odd.csv', {
      mode: 'commit',
      mapping: JSON.stringify({ Thing: 'title', When: 'dueDate' }),
    }).expect(201);
  });

  it('checks permissions and file types', async () => {
    const { project, viewer, outsider, owner } = await setupTeam();
    await upload(viewer.agent, project.key, SAMPLE, 'tasks.csv').expect(403);
    await upload(outsider, project.key, SAMPLE, 'tasks.csv').expect(404);
    await outsider.get(`/api/projects/${project.key}/tasks/export`).expect(404);
    await upload(owner, project.key, Buffer.from('hello'), 'notes.txt').expect(400);
    await upload(owner, project.key, Buffer.from('not a zip'), 'broken.xlsx').expect(400);
  });
});
