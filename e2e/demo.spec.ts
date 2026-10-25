import { expect, test } from '@playwright/test';
import { apiGet, signUp } from './helpers';

test('generates demo data and views the app as a demo teammate', async ({ page }) => {
  const me = await signUp(page, 'Demo Explorer');

  await page.goto('/settings/demo');
  await page.getByRole('radio', { name: /Small/ }).click();
  await page.getByLabel('Seed').fill('42');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText(/Generated \d+ tasks in \d+ projects \(seed 42\)/)).toBeVisible({
    timeout: 20_000,
  });

  const { status } = await apiGet<{
    status: { teammates: { id: string; name: string; roleName: string }[] };
  }>(page, '/demo');
  const qa = status.teammates.find((mate) => mate.roleName === 'QA')!;

  await page.goto('/projects');
  await expect(page.getByRole('main').getByText('Demo').first()).toBeVisible();

  await page.goto('/settings/demo');
  await page.getByRole('button', { name: `View as ${qa.name}` }).click();
  await expect(page.getByRole('status').filter({ hasText: `Viewing as ${qa.name}` })).toBeVisible();
  expect(
    (await apiGet<{ user: { id: string; impersonator: { id: string } } }>(page, '/auth/me')).user.impersonator
      .id,
  ).toBe(me.id);

  await page.getByRole('button', { name: 'Return to my account' }).click();
  await expect(page).toHaveURL('/settings/demo');
  await expect(page.getByRole('button', { name: 'Return to my account' })).toHaveCount(0);
  expect(
    (await apiGet<{ user: { id: string; impersonator: unknown } }>(page, '/auth/me')).user,
  ).toMatchObject({
    id: me.id,
    impersonator: null,
  });
});
