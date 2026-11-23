import { expect, test, type Locator } from '@playwright/test';
import { signUp } from './helpers';

const sideways = (body: Locator) =>
  body.evaluate((element) => ({
    overflow: element.scrollWidth - element.clientWidth,
    left: element.scrollLeft,
  }));

test('the flag editor in a new project fits the phone and never scrolls sideways', async ({ page }) => {
  await signUp(page, 'Flag Phone');
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  const body = dialog.locator('.overflow-y-auto').first();

  await dialog.getByRole('radio', { name: 'Flag', exact: true }).click();
  await dialog
    .getByRole('radiogroup', { name: 'Pattern' })
    .getByRole('radio', { name: 'Three bars' })
    .click();
  expect(await sideways(body)).toEqual({ overflow: 0, left: 0 });

  await dialog.getByRole('button', { name: 'Middle color' }).click();
  await page.getByRole('dialog', { name: 'Middle color' }).getByRole('radio', { name: '#22c55e' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Middle color' })).toHaveCount(0);
  expect(await sideways(body)).toEqual({ overflow: 0, left: 0 });
  await expect(dialog.getByRole('button', { name: 'Middle color' })).toBeInViewport();
});
