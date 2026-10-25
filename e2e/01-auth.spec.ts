import { expect, test } from '@playwright/test';
import { mailLink, PASSWORD, uniqueEmail } from './helpers';

test('signs up, verifies email, logs out and back in', async ({ page }) => {
  const email = uniqueEmail('signup');

  await page.goto('/register');
  await page.locator('#name').fill('Noa Levi');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(/to secure your account/)).toBeVisible();

  await page.goto(await mailLink(page, email, '/verify-email'));
  await expect(page.getByText('Your email is verified')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText(/to secure your account/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects/);

  await page.locator('#email').fill(email);
  await page.locator('#password').fill('wrong-password-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();

  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/projects');
});

test('resets a forgotten password and revokes old sessions', async ({ page, browser }) => {
  const email = uniqueEmail('reset');
  await page.goto('/register');
  await page.locator('#name').fill('Reset Me');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  const other = await browser.newPage();
  await other.goto('/forgot-password');
  await other.locator('#email').fill(email);
  await other.getByRole('button', { name: 'Send reset link' }).click();
  await expect(other.getByText('Check your inbox')).toBeVisible();

  await other.goto(await mailLink(other, email, '/reset-password'));
  await other.locator('#password').fill('brand-new-password-2');
  await other.locator('#confirm').fill('brand-new-password-2');
  await other.getByRole('button', { name: 'Update password' }).click();
  await expect(other).toHaveURL(/\/login\?reset=1/);

  await other.locator('#email').fill(email);
  await other.locator('#password').fill('brand-new-password-2');
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other).toHaveURL('/');

  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await other.close();
});
