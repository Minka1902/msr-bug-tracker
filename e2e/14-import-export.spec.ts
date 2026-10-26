import { expect, test } from '@playwright/test';
import { createProject, signUp } from './helpers';

test('imports the CSV template and exports the tasks again', async ({ page }) => {
  await signUp(page, 'Importer');
  const project = await createProject(page, 'Spreadsheet Land');
  const template = await page.request.get('/api/import/template?format=csv');
  expect(template.ok()).toBe(true);
  const csv = await template.text();
  expect(csv.split('\r\n')[0]).toContain('Title');

  await page.goto(`/p/${project.key}/list`);
  await page.getByRole('button', { name: 'Import / Export' }).click();
  await page.getByRole('menuitem', { name: 'Import CSV or Excel…' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'tasks.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: /Import 2 tasks/ }).click();
  await expect(page.getByText(/Created 2 tasks/)).toBeVisible();

  const exported = await page.request.get(`/api/projects/${project.key}/tasks/export?format=csv`);
  expect(exported.ok()).toBe(true);
  const rows = (await exported.text()).trim().split('\r\n');
  expect(rows).toHaveLength(3);
});
