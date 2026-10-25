import { expect, test } from '@playwright/test';
import { createProject, createTask, signUp } from './helpers';

test('finds tasks with filters and global search', async ({ page }) => {
  await signUp(page, 'Searcher');
  const shop = await createProject(page, 'Shop');
  const docs = await createProject(page, 'Docs');
  await createTask(page, shop.key, { title: 'Payment timeout on checkout', type: 'bug', priority: 'high' });
  await createTask(page, shop.key, { title: 'Refund flow', priority: 'urgent' });
  const typo = await createTask(page, docs.key, { title: 'Pricing page typo', priority: 'low' });

  await page.goto(`/p/${shop.key}/list`);
  const table = page.getByRole('table', { name: 'Tasks' });
  await expect(table.getByText('Refund flow')).toBeVisible();

  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('menuitem', { name: 'Priority' }).click();
  await page.getByRole('option', { name: 'High' }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/priority=high/);
  await expect(table.getByText('Payment timeout on checkout')).toBeVisible();
  await expect(table.getByText('Refund flow')).toHaveCount(0);

  await page.reload();
  await expect(table.getByText('Payment timeout on checkout')).toBeVisible();
  await expect(table.getByText('Refund flow')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByPlaceholder('Search tasks').fill('refund');
  await expect(table.getByText('Refund flow')).toBeVisible();
  await expect(table.getByText('Payment timeout on checkout')).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog');
  await palette.getByPlaceholder('Search tasks, projects or type a command…').fill('pricng');
  await expect(palette.getByRole('option', { name: /Pricing page typo/ })).toBeVisible();

  await palette
    .getByPlaceholder('Search tasks, projects or type a command…')
    .fill(typo.identifier.toLowerCase());
  await palette
    .getByRole('option', { name: new RegExp(typo.identifier) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`task=${typo.identifier}`));
  await expect(page.getByRole('dialog').getByText('Pricing page typo')).toBeVisible();
});
