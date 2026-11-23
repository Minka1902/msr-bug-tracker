import { expect, test } from '@playwright/test';
import { apiGet, createProject, createTask, isoDay, signUp } from './helpers';

test('selects board cards and changes them together', async ({ page }) => {
  await signUp(page, 'Bea Bulk');
  const { key } = await createProject(page, 'Bulk Board');
  for (const title of ['One', 'Two', 'Three', 'Four']) await createTask(page, key, { title });
  await page.goto(`/p/${key}/board`);

  await page.getByRole('button', { name: 'Select cards' }).click();
  for (const number of [1, 2])
    await page.getByRole('button', { name: new RegExp(`^${key}-${number}: `) }).click();
  await page.getByRole('button', { name: new RegExp(`^${key}-3: `) }).click({ modifiers: ['Shift'] });
  await expect(page.getByText('3 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Priority', exact: true }).click();
  await page.getByRole('option', { name: 'High' }).click();
  await expect(page.getByText('Priority updated for 3 tasks')).toBeVisible();
  await page.getByRole('button', { name: 'Due date', exact: true }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByText('Due date updated for 3 tasks')).toBeVisible();

  const { items } = await apiGet<{ items: { title: string; priority: string; dueDate: string | null }[] }>(
    page,
    `/projects/${key}/tasks`,
  );
  const byTitle = Object.fromEntries(items.map((task) => [task.title, task]));
  for (const title of ['One', 'Two', 'Three'])
    expect(byTitle[title]).toMatchObject({ priority: 'high', dueDate: isoDay() });
  expect(byTitle.Four).toMatchObject({ priority: 'medium', dueDate: null });

  await page.keyboard.press('Escape');
  await expect(page.getByText('3 selected')).toHaveCount(0);
});
