import { expect, test } from '@playwright/test';
import { apiGet, apiPost, createProject, createTask, signUp } from './helpers';

test('only shows projects and tasks a user is authorized to see', async ({ page, browser }) => {
  await signUp(page, 'Owner');
  const project = await createProject(page, 'Secret Plans');
  const task = await createTask(page, project.key, { title: 'Acquire competitor' });

  const outsider = await (await browser.newContext()).newPage();
  await signUp(outsider, 'Outsider', 'outsider');

  await outsider.goto(`/p/${project.key}/board`);
  await expect(outsider.getByText('Project not found')).toBeVisible();
  await outsider.goto(`/t/${task.identifier}`);
  await expect(outsider.getByText('Task not found')).toBeVisible();

  for (const path of [
    `/projects/${project.key}`,
    `/tasks/${task.id}`,
    `/tasks/${task.id}/comments`,
    `/tasks/by-identifier/${task.identifier}`,
  ])
    expect((await outsider.request.get(`/api${path}`)).status(), path).toBe(404);
  expect((await outsider.request.patch(`/api/tasks/${task.id}`, { data: { title: 'Pwned' } })).status()).toBe(
    404,
  );

  const search = await apiGet<{ tasks: unknown[]; projects: unknown[] }>(outsider, '/search?q=Acquire');
  expect(search.tasks).toHaveLength(0);
  await outsider.goto('/projects');
  await expect(outsider.getByRole('main').getByText('Secret Plans')).toHaveCount(0);
  await outsider.context().close();
});

test('a Viewer can read but not create, edit or assign', async ({ page, browser }) => {
  const owner = await signUp(page, 'Owner');
  const project = await createProject(page, 'Shared Board');
  const task = await createTask(page, project.key, { title: 'Draft roadmap', assigneeId: owner.id });

  const viewerPage = await (await browser.newContext()).newPage();
  const viewer = await signUp(viewerPage, 'Read Only', 'viewer');
  const { project: detail } = await apiGet<{
    project: { roles: { id: string; systemKey: string | null }[] };
  }>(page, `/projects/${project.key}`);
  await apiPost(page, `/projects/${project.key}/members`, {
    email: viewer.email,
    roleId: detail.roles.find((role) => role.systemKey === 'viewer')!.id,
  });

  await viewerPage.goto(`/p/${project.key}/list`);
  await expect(viewerPage.getByRole('table', { name: 'Tasks' }).getByText('Draft roadmap')).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: 'Add task' })).toHaveCount(0);
  await expect(
    viewerPage.getByRole('button', { name: `Assignee of ${task.identifier}: Owner` }),
  ).toBeDisabled();
  await expect(
    viewerPage.getByRole('button', { name: `Status of ${task.identifier}: Backlog` }),
  ).toBeDisabled();

  const create = await viewerPage.request.post(`/api/projects/${project.key}/tasks`, {
    data: { title: 'Sneaky' },
  });
  expect(create.status()).toBe(403);
  const assign = await viewerPage.request.patch(`/api/tasks/${task.id}`, { data: { assigneeId: viewer.id } });
  expect(assign.status()).toBe(403);
  await viewerPage.context().close();
});
