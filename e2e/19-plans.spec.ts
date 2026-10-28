import { expect, test, type Page } from '@playwright/test';
import { signUp, uniqueKey } from './helpers';

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name, exact: true });

const startProject = async (page: Page, module: string, name: string) => {
  const key = uniqueKey();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('radio', { name: new RegExp(module) }).click();
  await dialog.locator('#project-name').fill(name);
  await dialog.locator('#project-key').fill(key);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${key}/`));
  return key;
};

test('plans unlock modules, and Bugs only shows where bugs fit', async ({ page }) => {
  await signUp(page, 'Plan Shopper');
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await expect(dialog.getByRole('radio', { name: /Household/ })).toBeDisabled();
  await dialog.getByRole('link', { name: 'Upgrade or buy projects' }).click();

  await expect(page).toHaveURL(/\/shop$/);
  await page.getByRole('button', { name: 'Get Personal' }).click();
  await expect(page.getByLabel('Personal plan').getByText('Current plan')).toBeVisible();
  await page
    .getByLabel('Household', { exact: true })
    .getByRole('button', { name: 'Start a project' })
    .click();
  await startProject(page, 'Household', 'The Shoppers');
  await expect(tab(page, 'Chores')).toBeVisible();

  await page.goto('/projects');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: /Startup idea/ })).toBeDisabled();
  await startProject(page, 'Personal project', 'Half marathon');
  await expect(tab(page, 'Board')).toBeVisible();
  await expect(tab(page, 'Bugs')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Bugs' })).toHaveCount(0);

  await page.goto('/shop');
  await page.getByRole('button', { name: 'Get Pro' }).click();
  await expect(page.getByLabel('Pro plan').getByText('Current plan')).toBeVisible();
  await page
    .getByLabel('Startup idea', { exact: true })
    .getByRole('button', { name: 'Start a project' })
    .click();
  await startProject(page, 'Startup idea', 'Meal planner');
  await expect(tab(page, 'Bugs')).toBeVisible();
});

test('a free user buys a startup pack and spends it', async ({ page }) => {
  await signUp(page, 'Pack Buyer');
  await page.goto('/shop');
  const startup = page.getByLabel('Startup idea', { exact: true });
  await startup.getByRole('button', { name: /^10 projects/ }).click();
  await expect(startup.getByText('10 projects left')).toBeVisible();
  await startup.getByRole('button', { name: 'Start a project' }).click();
  await startProject(page, 'Startup idea', 'Packed idea');
  await page.goto('/shop');
  await expect(startup.getByText('9 projects left')).toBeVisible();
  await expect(page.getByText('Free · 0 of 3 new projects')).toBeVisible();
});

test('shows coming-soon modules only in the modules grid', async ({ page }) => {
  await signUp(page, 'Window Shopper');
  await page.goto('/shop');
  for (const name of ['Event', 'Home renovation', 'Job search', 'Trip', 'Fitness'])
    await expect(page.getByLabel(name, { exact: true }).getByText('Coming soon')).toBeVisible();
  await expect(page.getByLabel('Pro plan').getByText('Trip')).toHaveCount(0);
  await expect(page.getByLabel('Personal plan').getByText('Fitness')).toHaveCount(0);
});
