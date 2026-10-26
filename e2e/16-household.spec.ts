import { expect, test } from '@playwright/test';
import { apiGet, apiPost, createProject, createTask, isoDay, signUp } from './helpers';

test('a child can only finish their own chores, and everyone can use the shopping list', async ({
  page,
  browser,
}) => {
  await signUp(page, 'Pat Parent');
  const home = await createProject(page, 'The Testers', undefined, 'household');
  const childRole = home.roles.find((role) => role.systemKey === 'member')!.id;

  const kidPage = await (await browser.newContext()).newPage();
  const kid = await signUp(kidPage, 'Kim Kid', 'kid');
  const siblingPage = await (await browser.newContext()).newPage();
  const sibling = await signUp(siblingPage, 'Sam Sibling', 'sibling');
  await apiPost(page, `/projects/${home.key}/members`, { email: kid.email, roleId: childRole });
  await apiPost(page, `/projects/${home.key}/members`, { email: sibling.email, roleId: childRole });

  await createTask(page, home.key, {
    title: 'Feed the fish',
    type: 'chore',
    assigneeId: kid.id,
    dueDate: isoDay(),
  });
  await createTask(page, home.key, {
    title: 'Walk the dog',
    type: 'chore',
    assigneeId: sibling.id,
    dueDate: isoDay(),
  });

  await kidPage.goto(`/p/${home.key}`);
  await expect(kidPage).toHaveURL(new RegExp(`/p/${home.key}/home`));
  await expect(kidPage.getByRole('checkbox', { name: 'Mark Walk the dog as done' })).toBeDisabled();
  await expect(kidPage.getByRole('button', { name: 'Add chore' })).toHaveCount(0);
  await kidPage.getByRole('checkbox', { name: 'Mark Feed the fish as done' }).click();
  await expect(kidPage.getByRole('checkbox', { name: 'Mark Feed the fish as done' })).toHaveCount(0);

  await kidPage.getByRole('link', { name: 'Shopping' }).click();
  await kidPage.getByLabel('Item').fill('Fish food');
  await kidPage.getByRole('button', { name: 'Add', exact: true }).click();
  await kidPage.getByRole('checkbox', { name: 'Check off Fish food' }).click();
  await expect(kidPage.getByRole('checkbox', { name: 'Uncheck Fish food' })).toBeChecked();

  const { lists } = await apiGet<{ lists: { items: { name: string; isChecked: boolean }[] }[] }>(
    page,
    `/projects/${home.key}/lists`,
  );
  expect(lists[0]!.items).toEqual([expect.objectContaining({ name: 'Fish food', isChecked: true })]);
  await kidPage.context().close();
  await siblingPage.context().close();
});
