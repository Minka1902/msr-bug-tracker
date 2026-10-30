import { expect, test, type Page } from '@playwright/test';
import { createProject, createTask, signUp } from './helpers';

const LANDSCAPE = { width: 932, height: 430 };

const smallFields = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'input:not([type=hidden], [type=checkbox], [type=radio], [type=color], [type=file]), select, textarea, [contenteditable=true]',
      ),
    ]
      .filter((field) => field.getClientRects().length && parseFloat(getComputedStyle(field).fontSize) < 16)
      .map(
        (field) =>
          `${field.tagName.toLowerCase()} "${field.getAttribute('aria-label') ?? field.getAttribute('placeholder') ?? field.getAttribute('name') ?? ''}" ${getComputedStyle(field).fontSize}`,
      ),
  );

const expectNoZoom = async (page: Page, label: string) => {
  await page.waitForLoadState('networkidle');
  expect(await smallFields(page), label).toEqual([]);
};

test('no text field is small enough to make iOS zoom in on focus', async ({ page }) => {
  await signUp(page, 'Zoom Free');
  const { key } = await createProject(page, 'No Zoom');
  const task = await createTask(page, key, { title: 'Type here without zooming' });
  const home = await createProject(page, 'Zoom Home', undefined, 'household');

  for (const path of [
    '/',
    `/p/${key}/board`,
    `/p/${key}/settings/general`,
    `/p/${key}/settings/labels`,
    `/p/${key}/settings/members`,
    '/settings/profile',
    '/settings/account',
    `/p/${home.key}/shopping`,
  ]) {
    await page.goto(path);
    await expectNoZoom(page, path);
  }

  await page.goto(`/p/${key}/list?task=${task.identifier}`);
  const comment = page
    .getByRole('toolbar', { name: 'Task actions' })
    .getByRole('button', { name: 'Comment' });
  if (await comment.isVisible()) await comment.click();
  await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
  await expectNoZoom(page, 'task detail');

  await page.setViewportSize(LANDSCAPE);
  await expectNoZoom(page, 'task detail in landscape');

  await page.goto('/');
  await page.getByRole('button', { name: 'New task' }).first().click();
  await expect(page.getByRole('dialog', { name: 'New task' })).toBeVisible();
  await expectNoZoom(page, 'new task in landscape');

  await page.goto('/calendar');
  await page.getByRole('button', { name: 'New event' }).click();
  await expect(page.getByRole('dialog', { name: 'New event' })).toBeVisible();
  await expectNoZoom(page, 'new event in landscape');
});

test('a field without its own text size still gets at least 16px', async ({ page }) => {
  await signUp(page, 'Inherited Size');
  await page.goto('/');
  const size = await page.evaluate(() => {
    const wrapper = Object.assign(document.createElement('div'), { className: 'text-xs' });
    const input = wrapper.appendChild(document.createElement('input'));
    const editor = wrapper.appendChild(
      Object.assign(document.createElement('div'), { contentEditable: 'true' }),
    );
    document.body.append(wrapper);
    return [input, editor].map((field) => parseFloat(getComputedStyle(field).fontSize));
  });
  expect(size).toEqual([16, 16]);
});

test('fields keep a size larger than 16px when they were designed bigger', async ({ page }) => {
  await signUp(page, 'Big Title');
  const { key } = await createProject(page, 'Big Fields');
  const task = await createTask(page, key, { title: 'A headline-sized title' });
  await page.goto(`/p/${key}/list?task=${task.identifier}`);
  const title = page.getByRole('textbox', { name: 'Title' });
  await title.click();
  expect(parseFloat(await title.evaluate((field) => getComputedStyle(field).fontSize))).toBeGreaterThan(16);
});
