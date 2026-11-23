import { expect, test } from '@playwright/test';
import { apiGet, createProject, createTask, signUp } from './helpers';

test('on phones, Select picks list rows and moves them to another project', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 744, 'Tablets use the table with checkboxes');
  await signUp(page, 'Mo Mover');
  const source = await createProject(page, 'Move From');
  const target = await createProject(page, 'Move To');
  for (const title of ['Alpha', 'Beta', 'Gamma']) await createTask(page, source.key, { title });
  await page.goto(`/p/${source.key}/list`);

  await page.getByRole('button', { name: 'Select tasks' }).click();
  await page.getByRole('checkbox', { name: /Alpha/ }).click();
  await page.getByRole('checkbox', { name: /Beta/ }).click();
  await expect(page.getByText('2 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Move 2 tasks' });
  await dialog.getByRole('button', { name: 'Target project' }).click();
  await page.getByRole('option', { name: /Move To/ }).click();
  await dialog.getByRole('button', { name: 'Move tasks' }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () =>
      (await apiGet<{ items: { title: string }[] }>(page, `/projects/${target.key}/tasks`)).items
        .map((task) => task.title)
        .sort(),
    )
    .toEqual(['Alpha', 'Beta']);
});
