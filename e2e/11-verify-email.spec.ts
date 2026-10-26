import { expect, test } from '@playwright/test';
import { apiPost, mailLink, PASSWORD, uniqueEmail } from './helpers';

test('a verification link still works when it is opened twice', async ({ page }) => {
  const email = uniqueEmail('twice');
  await apiPost(page, '/auth/register', { name: 'Twice Clicked', email, password: PASSWORD });
  const link = await mailLink(page, email, '/verify-email');

  await page.goto(link);
  await expect(page.getByText('Your email is verified')).toBeVisible();
  await page.goto(link);
  await expect(page.getByText('Your email is verified')).toBeVisible();
});
