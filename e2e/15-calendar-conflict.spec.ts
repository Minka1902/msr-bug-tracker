import { expect, test } from '@playwright/test';
import { apiGet, apiPost, createProject, isoDay, signUp } from './helpers';

test('warns before a due date lands on a very important event', async ({ page }) => {
  await signUp(page, 'Busy Person');
  const project = await createProject(page, 'Clash Test');
  const day = isoDay(2);
  await apiPost(page, '/calendar/events', {
    title: 'Wedding',
    startsAt: `${day}T00:00:00Z`,
    endsAt: `${day}T00:00:00Z`,
    allDay: true,
    important: true,
  });

  await page.goto(`/p/${project.key}/board`);
  await page.getByRole('button', { name: 'Add task' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Ship the release');
  await dialog.getByRole('button', { name: 'Due date' }).click();
  await page
    .locator('.rdp-day_button', { hasText: new RegExp(`^${Number(day.slice(8))}$`) })
    .first()
    .click();
  await dialog.getByRole('button', { name: 'Create task' }).click();

  const warning = page.getByRole('alertdialog', { name: 'This clashes with a very important event' });
  await expect(warning.getByText('Wedding')).toBeVisible();
  await warning.getByRole('button', { name: 'Change it' }).click();
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('button', { name: 'Save anyway' }).click();
  await expect(dialog).toBeHidden();
  const { items } = await apiGet<{ items: { title: string; dueDate: string }[] }>(
    page,
    `/projects/${project.key}/tasks`,
  );
  expect(items).toEqual([expect.objectContaining({ title: 'Ship the release', dueDate: day })]);
});
