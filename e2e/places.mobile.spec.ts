import { expect, test } from '@playwright/test';
import { createProject, signUp } from './helpers';

test('a household keeps its places, with call and navigation links', async ({ page }) => {
  await signUp(page, 'Paz Places');
  const home = await createProject(page, 'Place Home', undefined, 'household');
  await page.goto(`/p/${home.key}/places`);
  await page
    .getByRole('navigation', { name: 'Project views' })
    .getByRole('link', { name: 'Places' })
    .waitFor();

  await page.getByRole('button', { name: 'Add place' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add place' });
  await form.getByLabel('Name').fill('Dr. Levi');
  await form.getByLabel('Phone', { exact: true }).fill('03-555-1234');
  await form.getByLabel('Address').fill('Herzl 5');
  await form.getByLabel('City').fill('Tel Aviv');
  await form.getByRole('button', { name: 'Save place' }).click();
  await expect(form).toBeHidden();

  const card = page.getByRole('article', { name: 'Dr. Levi' });
  await expect(card.getByRole('link', { name: 'Call 03-555-1234' })).toHaveAttribute(
    'href',
    'tel:03-555-1234',
  );
  await expect(card.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=Herzl%205%2C%20Tel%20Aviv',
  );
  await expect(card.getByRole('link', { name: 'Open in Waze' })).toHaveAttribute(
    'href',
    'https://waze.com/ul?q=Herzl%205%2C%20Tel%20Aviv&navigate=yes',
  );
  await page.reload();
  await expect(card).toBeVisible();
});
