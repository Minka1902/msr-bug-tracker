import { expect, test } from '@playwright/test';
import { apiGet, createProject, signUp } from './helpers';

test('designs a flag emblem for a project and shows it everywhere the project appears', async ({ page }) => {
  await signUp(page, 'Flag Maker');
  const { key } = await createProject(page, 'Flag Project');
  await page.goto(`/p/${key}/settings/general`);

  await page.getByRole('radio', { name: 'Flag' }).click();
  await page.getByRole('radiogroup', { name: 'Shape' }).getByRole('radio', { name: 'Shield' }).click();
  await page.getByRole('radiogroup', { name: 'Pattern' }).getByRole('radio', { name: 'Three bars' }).click();
  await page.getByRole('radiogroup', { name: 'Divider width' }).getByRole('radio', { name: 'Thick' }).click();
  await page.getByRole('button', { name: 'Middle color' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: '#22c55e' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('switch', { name: 'Show icon' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Project updated')).toBeVisible();

  const { project } = await apiGet<{ project: { emblem: Record<string, unknown> } }>(
    page,
    `/projects/${key}`,
  );
  expect(project.emblem).toMatchObject({
    shape: 'shield',
    pattern: 'bars-3',
    colors: ['#4f56f0', '#22c55e', '#4f56f0'],
    divider: { width: 3 },
    showIcon: false,
  });

  await page.reload();
  await expect(page.locator('main svg[data-emblem="bars-3"]').first()).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).locator('svg[data-emblem="bars-3"]'),
  ).toBeVisible();

  await page.getByRole('radio', { name: 'Simple' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Project updated')).toBeVisible();
  expect(
    (await apiGet<{ project: { emblem: unknown } }>(page, `/projects/${key}`)).project.emblem,
  ).toBeNull();
});
