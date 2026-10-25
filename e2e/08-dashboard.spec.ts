import { expect, test } from '@playwright/test';
import { apiPatch, createProject, createTask, projectStatuses, signUp } from './helpers';

const isoDay = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA');
};

test('shows progress and outstanding work on the dashboard', async ({ page }) => {
  await signUp(page, 'Dashboard Viewer');
  const { key } = await createProject(page, 'Launch');
  const statuses = await projectStatuses(page, key);
  const status = (workflow: string, name: string) =>
    statuses.find((item) => item.workflow === workflow && item.name === name)!.id;

  await createTask(page, key, { title: 'Pick domain', statusId: status('task', 'Done') });
  await createTask(page, key, { title: 'Write copy', statusId: status('task', 'Done') });
  const build = await createTask(page, key, {
    title: 'Build landing page',
    statusId: status('task', 'In Progress'),
    dueDate: isoDay(3),
  });
  await createTask(page, key, {
    title: 'Order swag',
    statusId: status('task', 'To Do'),
    dueDate: isoDay(-3),
  });
  await createTask(page, key, {
    title: 'Signup form rejects plus addresses',
    type: 'bug',
    priority: 'urgent',
  });

  await page.goto('/');
  const stat = (label: string) => page.getByRole('group', { name: label });
  const value = (label: string) => stat(label).locator('.font-display');
  await expect(value('Open')).toHaveText('3');
  await expect(value('Completed')).toHaveText('2');
  await expect(value('In progress')).toHaveText('1');
  await expect(value('Overdue')).toHaveText('1');

  const region = (name: string) => page.getByRole('region', { name });
  await expect(region('Projects').getByText('Launch')).toBeVisible();
  await expect(region('High-priority bugs').getByText('Signup form rejects plus addresses')).toBeVisible();
  await expect(region('Upcoming deadlines').getByText('Build landing page')).toBeVisible();

  await apiPatch(page, `/tasks/${build.id}`, { statusId: status('task', 'Done') });
  await page.reload();
  await expect(value('Completed')).toHaveText('3');
  await expect(value('In progress')).toHaveText('0');
  await expect(value('Open')).toHaveText('2');
});
