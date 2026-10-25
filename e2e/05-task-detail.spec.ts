import { expect, test } from '@playwright/test';
import { apiGet, createProject, createTask, signUp } from './helpers';

test('manages description, comments, attachments, subtasks and checklist', async ({ page }) => {
  await signUp(page, 'Detail Editor');
  const { key } = await createProject(page, 'Details');
  const task = await createTask(page, key, { title: 'Checkout redesign' });
  await page.goto(`/p/${key}/${task.number}`);

  const region = (name: string) => page.getByRole('region', { name });

  const description = region('Description').getByRole('textbox', { name: 'Description' });
  await description.click();
  await description.pressSequentially('Acceptance: totals update without reload.');
  await region('Subtasks').getByPlaceholder('Add a subtask and press Enter').click();
  await expect
    .poll(
      async () =>
        (await apiGet<{ task: { description: string } }>(page, `/tasks/${task.id}`)).task.description,
    )
    .toContain('Acceptance: totals update without reload.');

  await page.getByRole('textbox', { name: 'Comment' }).click();
  await page.keyboard.type('Looks good, shipping after QA.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Comment' })).toHaveText('');
  await expect(page.getByText('Looks good, shipping after QA.')).toBeVisible();

  await region('Attachments')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Repro notes\nStep 1: open checkout\n'),
    });
  await expect(region('Attachments').getByText('notes.txt')).toBeVisible();

  const subtaskInput = region('Subtasks').getByPlaceholder('Add a subtask and press Enter');
  await subtaskInput.fill('Update price summary');
  await subtaskInput.press('Enter');
  await expect(region('Subtasks').getByText('Update price summary')).toBeVisible();

  const checklistInput = region('Checklist').getByPlaceholder('Add an item and press Enter');
  await checklistInput.fill('Test on Safari');
  await checklistInput.press('Enter');
  await region('Checklist').getByRole('checkbox', { name: 'Test on Safari' }).click();
  await expect(region('Checklist').getByRole('checkbox', { name: 'Test on Safari' })).toBeChecked();

  await page.reload();
  await expect(region('Description').getByText('Acceptance: totals update without reload.')).toBeVisible();
  await expect(page.getByText('Looks good, shipping after QA.')).toBeVisible();
  await expect(region('Attachments').getByText('notes.txt')).toBeVisible();
  await expect(region('Subtasks').getByText('Update price summary')).toBeVisible();
  await expect(region('Checklist').getByRole('checkbox', { name: 'Test on Safari' })).toBeChecked();

  const detail = (
    await apiGet<{
      task: { commentCount: number; attachmentCount: number; subtaskTotal: number; checklistDone: number };
    }>(page, `/tasks/${task.id}`)
  ).task;
  expect(detail).toMatchObject({ commentCount: 1, attachmentCount: 1, subtaskTotal: 1, checklistDone: 1 });
});
