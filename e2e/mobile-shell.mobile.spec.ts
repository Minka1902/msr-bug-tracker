import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { apiGet, apiPatch, createProject, createTask, signUp } from './helpers';

const isTablet = (page: Page) => page.viewportSize()!.width >= 744;

const undersizedControls = (page: Page) =>
  page.evaluate(() => {
    const tap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap'));
    const controls = document.querySelectorAll(
      'button, a[href], [role=tab], [role=radio], [role=menuitem], [role=checkbox], [role=switch], [role=button], input:not([type=hidden]), select, textarea',
    );
    const found: string[] = [];
    for (const control of controls) {
      if (control.closest('[aria-hidden=true], .sr-only, .ProseMirror') || control.matches(':disabled'))
        continue;
      const rect = control.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
      const before = getComputedStyle(control, '::before');
      const reach = (value: string) => Math.min(0, parseFloat(value) || 0);
      const extended = before.content !== 'none' && before.position === 'absolute';
      const width = rect.width - (extended ? reach(before.left) + reach(before.right) : 0);
      const height = rect.height - (extended ? reach(before.top) + reach(before.bottom) : 0);
      if (width < tap - 0.5 || height < tap - 0.5)
        found.push(
          `${(control.getAttribute('aria-label') ?? control.textContent ?? '').trim()} ${Math.round(width)}×${Math.round(height)}`,
        );
    }
    return found;
  });

const swipe = async (page: Page, from: { x: number; y: number }, dx: number, dy = 0) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
  await page.mouse.up();
};

const centerOf = async (page: Page, locator: ReturnType<Page['locator']>) => {
  await locator.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};

test('every control is at least the touch size, and Large makes them bigger', async ({ page }) => {
  await signUp(page, 'Thumb User');
  const { key } = await createProject(page, 'Thumbs');
  const task = await createTask(page, key, { title: 'Reachable task' });

  for (const path of [
    '/',
    '/my-tasks',
    '/projects',
    `/p/${key}/board`,
    `/p/${key}/list`,
    `/p/${key}/list?task=${task.identifier}`,
    '/settings/appearance',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await undersizedControls(page), path).toEqual([]);
  }

  await apiPatch(page, '/me', { preferences: { touch: 'large' } });
  await page.goto('/my-tasks');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-touch', 'large');
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tap')),
  ).toBe('52px');
  expect(await undersizedControls(page)).toEqual([]);
});

test('phones navigate from the bottom: tab bar, menu sheet and a + button on the thumb side', async ({
  page,
}) => {
  test.skip(isTablet(page), 'Tablets use the icon rail');
  await signUp(page, 'Thumb Navigator');
  const { key } = await createProject(page, 'Reach');
  await page.goto(`/p/${key}/overview`);
  await page.waitForLoadState('networkidle');

  const tabBar = page.getByRole('navigation', { name: 'Tab bar' });
  await tabBar.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu.getByRole('link', { name: 'Calendar' })).toBeVisible();
  const heading = await centerOf(page, menu.getByRole('heading', { name: 'Menu' }));
  await swipe(page, heading, 0, 260);
  await expect(menu).toBeHidden();

  const width = page.viewportSize()!.width;
  const fab = page.getByRole('button', { name: 'New task in Reach' });
  expect((await centerOf(page, fab)).x).toBeGreaterThan(width / 2);
  await apiPatch(page, '/me', { preferences: { hand: 'left' } });
  await page.reload();
  expect((await centerOf(page, fab)).x).toBeLessThan(width / 2);

  await fab.click();
  await expect(page.getByRole('dialog', { name: 'New task' })).toBeVisible();
});

test('a swipe toward the palm finishes a task and the board moves cards onto status pills', async ({
  page,
}) => {
  test.skip(isTablet(page), 'Swipes are for phones');
  await signUp(page, 'Swiper');
  const { key } = await createProject(page, 'Swipes');
  const listed = await createTask(page, key, { title: 'Swipe me done' });
  const boarded = await createTask(page, key, { title: 'Drag me along' });
  const statusOf = async (identifier: string) =>
    (
      await apiGet<{ task: { statusCategory: string; statusId: string } }>(
        page,
        `/tasks/by-identifier/${identifier}`,
      )
    ).task;

  await page.goto(`/p/${key}/list`);
  await page.waitForLoadState('networkidle');
  const row = await centerOf(page, page.getByRole('button', { name: /Swipe me done/ }));
  await swipe(page, row, -160);
  await expect(page.getByText(`${listed.identifier} done`)).toBeVisible();
  expect((await statusOf(listed.identifier)).statusCategory).toBe('done');

  await page.goto(`/p/${key}/board`);
  await page.waitForLoadState('networkidle');
  const card = await centerOf(
    page,
    page.getByRole('button', { name: `${boarded.identifier}: Drag me along` }),
  );
  const pill = await centerOf(page, page.getByRole('tab', { name: /^To Do/ }));
  await page.mouse.move(card.x, card.y);
  await page.mouse.down();
  await page.mouse.move(card.x, card.y + 12, { steps: 3 });
  await page.mouse.move(pill.x, pill.y, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByText(`${boarded.identifier} moved to To Do`)).toBeVisible();
  expect((await statusOf(boarded.identifier)).statusCategory).toBe('todo');
});

test('task details open as a sheet with the actions at the bottom on phones, and beside the rail on tablets', async ({
  page,
}) => {
  await signUp(page, 'Detail Reader');
  const { key } = await createProject(page, 'Details');
  const task = await createTask(page, key, { title: 'Read me on a phone' });
  await page.goto(`/p/${key}/list?task=${task.identifier}`);

  if (isTablet(page)) {
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tab bar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible();
    return;
  }

  const actions = page.getByRole('toolbar', { name: 'Task actions' });
  await expect(actions).toBeVisible();
  const box = (await actions.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(page.viewportSize()!.height - 8);
  await actions.getByRole('button', { name: 'Comment' }).click();
  await expect(page.locator('[contenteditable="true"]:focus')).toHaveCount(1);
  await actions.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
});

test('the touch shell passes WCAG 2 A/AA checks', async ({ page }) => {
  const scan = async (label: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      ),
      label,
    ).toEqual([]);
  };

  await signUp(page, 'Axe Thumb');
  const { key } = await createProject(page, 'Axe Phone');
  await createTask(page, key, { title: 'Checked by axe' });
  for (const path of ['/', `/p/${key}/board`, '/settings/appearance']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await scan(path);
  }
  if (isTablet(page)) return;
  await page.getByRole('navigation', { name: 'Tab bar' }).getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await scan('menu sheet');
});
