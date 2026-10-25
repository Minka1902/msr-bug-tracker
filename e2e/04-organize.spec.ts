import { expect, test, type Page } from '@playwright/test';
import { createProject, createTask, signUp } from './helpers';

const isoDay = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA');
};

const rowIds = async (page: Page) =>
  page
    .getByRole('table', { name: 'Tasks' })
    .getByRole('row')
    .evaluateAll((rows) =>
      rows
        .slice(1)
        .map((row) =>
          [...row.querySelectorAll('[role=cell]')]
            .map((cell) => cell.textContent?.trim())
            .find((text) => /^[A-Z][A-Z0-9]*-\d+$/.test(text ?? '')),
        ),
    );

test('organizes work by status, priority, type and deadline', async ({ page }) => {
  const me = await signUp(page, 'Organizer');
  const { key } = await createProject(page, 'Organize');
  const low = await createTask(page, key, {
    title: 'Tidy README',
    priority: 'low',
    dueDate: isoDay(20),
    assigneeId: me.id,
  });
  const late = await createTask(page, key, {
    title: 'Renew certificate',
    priority: 'high',
    dueDate: isoDay(-2),
    assigneeId: me.id,
  });
  const today = await createTask(page, key, {
    title: 'Ship hotfix',
    priority: 'medium',
    dueDate: isoDay(0),
    assigneeId: me.id,
  });
  const bug = await createTask(page, key, {
    title: 'Crash on upload',
    type: 'bug',
    priority: 'medium',
    assigneeId: me.id,
  });

  await page.goto(`/p/${key}/list`);
  await page.getByRole('button', { name: `Priority of ${low.identifier}: Low` }).click();
  await page.getByRole('option', { name: 'Urgent' }).click();
  await expect(page.getByRole('button', { name: `Priority of ${low.identifier}: Urgent` })).toBeVisible();

  await page.getByRole('button', { name: `Status of ${today.identifier}` }).click();
  await page.getByRole('option', { name: 'In Progress' }).click();
  await expect(
    page.getByRole('button', { name: `Status of ${today.identifier}: In Progress` }),
  ).toBeVisible();

  await page.getByRole('columnheader', { name: 'Priority' }).getByRole('button').click();
  await expect
    .poll(() => rowIds(page))
    .toEqual([low.identifier, late.identifier, bug.identifier, today.identifier]);

  await page.getByRole('columnheader', { name: 'Due' }).getByRole('button').click();
  await expect
    .poll(() => rowIds(page))
    .toEqual([late.identifier, today.identifier, low.identifier, bug.identifier]);

  await page.reload();
  await expect(page.getByRole('button', { name: `Priority of ${low.identifier}: Urgent` })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Due' })).toHaveAttribute('aria-sort', 'ascending');

  await page.goto(`/p/${key}/bugs`);
  await expect(page.getByRole('table').getByText('Crash on upload')).toBeVisible();
  await expect(page.getByRole('table').getByText('Ship hotfix')).toHaveCount(0);

  await page.goto(`/p/${key}/board`);
  await expect(page.getByRole('group', { name: 'In Progress' }).getByText('Ship hotfix')).toBeVisible();

  await page.goto('/my-tasks');
  const section = (label: string) => page.getByRole('region', { name: label });
  await expect(section('Overdue').getByText('Renew certificate')).toBeVisible();
  await expect(section('Today').getByText('Ship hotfix')).toBeVisible();
  await expect(section('Later').getByText('Tidy README')).toBeVisible();
  await expect(section('No due date').getByText('Crash on upload')).toBeVisible();
});
