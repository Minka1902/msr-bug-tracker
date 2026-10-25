import { expect, test } from '@playwright/test';
import { createProject, createTask, PASSWORD, signUp } from './helpers';

test('logs out and returns later with all project data preserved', async ({ page, browser }) => {
  const me = await signUp(page, 'Returning User');
  const project = await createProject(page, 'Long Haul');
  const task = await createTask(page, project.key, { title: 'Quarterly review', priority: 'high' });

  await page.goto(`/p/${project.key}/${task.number}`);
  await page.getByRole('textbox', { name: 'Comment' }).click();
  await page.keyboard.type('Notes from Monday.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Comment' })).toHaveText('');
  await expect(page.getByText('Notes from Monday.')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/p/${project.key}/${task.number}`);
  await expect(page).toHaveURL(/\/login\?next=/);

  const later = await browser.newPage();
  await later.goto('/login');
  await later.locator('#email').fill(me.email);
  await later.locator('#password').fill(PASSWORD);
  await later.getByRole('button', { name: 'Sign in' }).click();
  await expect(later).toHaveURL('/');

  await later.goto('/projects');
  await expect(later.getByRole('main').getByRole('link', { name: 'Long Haul' })).toBeVisible();
  await later.goto(`/t/${task.identifier}`);
  await expect(later.getByRole('textbox', { name: 'Title' })).toHaveText('Quarterly review');
  await expect(later.getByText('Notes from Monday.')).toBeVisible();
  await expect(later.getByRole('button', { name: `Priority of ${task.identifier}: High` })).toBeVisible();
  await later.close();
});
