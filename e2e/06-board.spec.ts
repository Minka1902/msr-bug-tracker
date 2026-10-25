import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiGet, createProject, createTask, projectStatuses, signUp } from './helpers';

const dragTo = async (page: Page, source: Locator, target: Locator) => {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 40, { steps: 20 });
  await page.mouse.up();
};

test('moves tasks across the Kanban board with mouse and keyboard', async ({ page }) => {
  await signUp(page, 'Board User');
  const { key } = await createProject(page, 'Board');
  const statuses = await projectStatuses(page, key);
  const status = (name: string) => statuses.find((item) => item.workflow === 'task' && item.name === name)!;
  const task = await createTask(page, key, { title: 'Write tests', statusId: status('To Do').id });
  const statusOf = async () =>
    (await apiGet<{ task: { statusId: string; completedAt: string | null } }>(page, `/tasks/${task.id}`))
      .task;

  await page.goto(`/p/${key}/board`);
  const column = (name: string) => page.getByRole('group', { name });
  const card = (name: string) => column(name).getByRole('button', { name: /Write tests/ });
  await expect(card('To Do')).toBeVisible();

  await dragTo(page, card('To Do'), column('In Progress'));
  await expect(card('In Progress')).toBeVisible();
  await expect.poll(async () => (await statusOf()).statusId).toBe(status('In Progress').id);

  await card('In Progress').focus();
  const live = page.locator('[aria-live]').first();
  await page.keyboard.press('Space');
  await expect(live).toHaveText(`${task.identifier}: Write tests is over In Progress.`);
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText(`${task.identifier}: Write tests is over In Review.`);
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText(`${task.identifier}: Write tests is over Done.`);
  await page.keyboard.press('Space');
  await expect(live).toHaveText(`${task.identifier}: Write tests dropped in Done.`);
  await expect(card('Done')).toBeVisible();
  await expect.poll(async () => (await statusOf()).completedAt).not.toBeNull();

  await page.reload();
  await expect(card('Done')).toBeVisible();
  await expect(card('In Progress')).toHaveCount(0);
});
