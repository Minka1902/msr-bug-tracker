import { expect, test } from '@playwright/test';
import { createProject, createTask, signUp } from './helpers';

test('is installable on iPhone with icons, splash screens and iOS tags', async ({ page }) => {
  await page.goto('/login');
  const head = page.locator('head');
  await expect(head.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(head.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    'content',
    'black-translucent',
  );
  await expect(head.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(head.locator('meta[name="theme-color"]')).toHaveCount(1);
  expect(await head.locator('link[rel="apple-touch-startup-image"]').count()).toBeGreaterThan(10);

  const touchIcon = await head.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await page.request.get(touchIcon!)).ok()).toBe(true);

  const manifest = await (
    await page.request.get((await head.locator('link[rel="manifest"]').getAttribute('href'))!)
  ).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', short_name: 'MSR' });
  const sizes = manifest.icons.map(
    (icon: { sizes: string; purpose?: string }) => `${icon.sizes}${icon.purpose ? `/${icon.purpose}` : ''}`,
  );
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512/maskable']));
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
});

test('serves the app shell offline and shows the install hint once', async ({ page, context }) => {
  await signUp(page, 'Phone User');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const hint = page.getByText('Install MSR on your iPhone');
  await expect(hint).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(hint).toHaveCount(0);

  await context.setOffline(true);
  await page.evaluate(() => {
    location.href = '/my-tasks';
  });
  await expect(page.getByText("You're offline")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('heading', { name: 'My Tasks' })).toBeVisible();
});

test('fits phone screens without horizontal scrolling', async ({ page }) => {
  await signUp(page, 'Narrow Screen');
  const { key } = await createProject(page, 'Phone Layout');
  const task = await createTask(page, key, {
    title: 'A fairly long task title that should wrap nicely on a phone',
    type: 'bug',
  });
  const home = await createProject(page, 'Phone Household', undefined, 'household');

  for (const path of [
    '/',
    '/my-tasks',
    '/projects',
    `/p/${key}/overview`,
    `/p/${key}/board`,
    `/p/${key}/list`,
    `/p/${key}/${task.number}`,
    '/settings/appearance',
    '/calendar',
    `/p/${home.key}/home`,
    `/p/${home.key}/shopping`,
    `/p/${home.key}/calendar`,
    '/settings/calendars',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Tab bar' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
