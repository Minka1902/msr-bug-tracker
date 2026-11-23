import { expect, test } from '@playwright/test';
import { createProject, signUp } from './helpers';

const ALIEXPRESS =
  'I just found this on AliExpress: US $12.34 | Garden Hose 30m https://a.aliexpress.com/_mKxyz12';

test('a product shared from a store app lands on the main household list with its link', async ({ page }) => {
  await signUp(page, 'Sara Share');
  await createProject(page, 'Work Stuff');
  const home = await createProject(page, 'Share Home', undefined, 'household');
  await page.goto(`/share?text=${encodeURIComponent(ALIEXPRESS)}`);

  await expect(page.getByLabel('Item')).toHaveValue('Garden Hose 30m');
  await expect(page.getByRole('button', { name: 'Household' })).toContainText('Share Home');
  await page.getByRole('button', { name: 'Add to list' }).click();

  await expect(page).toHaveURL(new RegExp(`/p/${home.key}/shopping`));
  await expect(page.getByRole('link', { name: 'Open in AliExpress' })).toHaveAttribute(
    'href',
    'https://a.aliexpress.com/_mKxyz12',
  );
});

test('pasting share text into a list keeps the product link', async ({ page }) => {
  await signUp(page, 'Pat Paste');
  const home = await createProject(page, 'Paste Home', undefined, 'household');
  await page.goto(`/p/${home.key}/shopping`);
  await page
    .getByLabel('Item')
    .fill('Check out this deal on Amazon: Kindle Paperwhite https://a.co/d/abc123');
  await page.getByLabel('Item').press('Enter');

  const row = page.getByRole('listitem').filter({ hasText: 'Kindle Paperwhite' });
  await expect(row.getByRole('link', { name: 'Open in Amazon' })).toHaveAttribute(
    'href',
    'https://a.co/d/abc123',
  );
  await expect(row).not.toContainText('https://');
});
