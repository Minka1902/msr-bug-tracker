import { expect, test } from '@playwright/test';
import { apiGet, apiPost, createProject, signUp } from './helpers';

test('a second account joins a project from an invite link', async ({ page, browser }) => {
  await signUp(page, 'Inviting Owner');
  const project = await createProject(page, 'Invite Party');
  const { invite } = await apiPost<{ invite: { url: string } }>(page, `/projects/${project.key}/invites`, {
    roleId: project.roles.find((role) => role.systemKey === 'member')!.id,
  });

  const guest = await (await browser.newContext()).newPage();
  const joiner = await signUp(guest, 'New Member', 'joiner');
  await guest.goto(new URL(invite.url).pathname);
  await expect(guest.getByRole('heading', { name: 'Join Invite Party' })).toBeVisible();
  await guest.getByRole('button', { name: 'Join project' }).click();
  await expect(guest).toHaveURL(new RegExp(`/p/${project.key}`));

  const { project: detail } = await apiGet<{
    project: { memberList: { email: string; roleName: string }[] };
  }>(page, `/projects/${project.key}`);
  expect(detail.memberList.find((member) => member.email === joiner.email)?.roleName).toBe('Member');
  await guest.context().close();
});
