import { expect, test } from '@playwright/test';
import { createTask, signUp, uniqueKey } from './helpers';

test('creates and manages multiple independent projects', async ({ page }) => {
  await signUp(page, 'Project Owner');
  const web = { name: 'Website Redesign', key: uniqueKey() };
  const app = { name: 'Mobile App', key: uniqueKey() };

  for (const project of [web, app]) {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    await page.locator('#project-name').fill(project.name);
    await page.locator('#project-key').fill(project.key);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${project.key}/`));
  }

  expect((await createTask(page, web.key, { title: 'Hero copy' })).identifier).toBe(`${web.key}-1`);
  expect((await createTask(page, app.key, { title: 'Login screen' })).identifier).toBe(`${app.key}-1`);

  await page.goto('/projects');
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: web.name })).toBeVisible();
  await expect(main.getByRole('link', { name: app.name })).toBeVisible();

  await main.getByRole('button', { name: `Add ${web.name} to favorites` }).click();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(main.getByRole('link', { name: web.name })).toBeVisible();
  await expect(main.getByRole('link', { name: app.name })).toHaveCount(0);

  await page.goto(`/p/${web.key}/settings/general`);
  await page.locator('#name').fill('Marketing Site');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Marketing Site' })).toBeVisible();

  await page.goto(`/p/${app.key}/settings/danger`);
  await page.getByRole('button', { name: 'Archive project' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Project archived')).toBeVisible();

  await page.goto('/projects');
  await expect(main.getByRole('link', { name: 'Marketing Site' })).toBeVisible();
  await expect(main.getByRole('link', { name: app.name })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Archived' }).click();
  await expect(main.getByRole('link', { name: app.name })).toBeVisible();
});
