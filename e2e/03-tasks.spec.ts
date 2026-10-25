import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { apiGet, createProject, createTask, signUp } from './helpers';

const SCREENSHOT = fs.readFileSync('server/test/fixtures/red.png').toString('base64');

test('adds tasks and bugs, including a pasted screenshot', async ({ page }) => {
  await signUp(page, 'Task Author');
  const project = await createProject(page, 'Checkout');
  await page.goto(`/p/${project.key}/board`);

  await page.getByRole('button', { name: 'New task' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByLabel('Title').fill('Write release notes');
  await dialog.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByText(`${project.key}-1 created`)).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'New task' }).first().click();
  await dialog.getByRole('radio', { name: 'Bug' }).click();
  await dialog.getByLabel('Title').fill('Pay button does nothing on Safari');
  const editor = dialog.getByRole('textbox', { name: 'Description' });
  await editor.click();
  await editor.pressSequentially('Tap Pay on the checkout page. ');
  await editor.evaluate((element, base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'safari.png', { type: 'image/png' }));
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, SCREENSHOT);
  await expect(editor.locator('img')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByText(`${project.key}-2 created`)).toBeVisible();

  const bug = await apiGet<{ task: { type: string; attachmentCount: number; description: string } }>(
    page,
    `/tasks/by-identifier/${project.key}-2`,
  );
  expect(bug.task.type).toBe('bug');
  expect(bug.task.attachmentCount).toBe(1);
  expect(bug.task.description).toContain('![safari.png](/api/attachments/');

  await page.goto(`/p/${project.key}/bugs`);
  await expect(page.getByRole('table').getByText('Pay button does nothing on Safari')).toBeVisible();
  await expect(page.getByRole('table').getByText('Write release notes')).toHaveCount(0);
});

test('holds many tasks per project', async ({ page }) => {
  await signUp(page, 'Bulk Author');
  const project = await createProject(page, 'Backlog');
  await Promise.all(
    Array.from({ length: 60 }, (_, index) => createTask(page, project.key, { title: `Item ${index + 1}` })),
  );

  const numbers = (
    await apiGet<{ items: { number: number }[] }>(page, `/projects/${project.key}/tasks?limit=100`)
  ).items.map((task) => task.number);
  expect(new Set(numbers).size).toBe(60);
  expect(Math.max(...numbers)).toBe(60);

  await page.goto(`/p/${project.key}/list`);
  const table = page.getByRole('table', { name: 'Tasks' });
  await page.getByPlaceholder('Search tasks').fill('Item 60');
  await expect(table.getByText('Item 60', { exact: true })).toBeVisible();
});
