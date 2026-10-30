import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { apiGet, createProject, createTask, signUp } from './helpers';

const SCREENSHOT = fs.readFileSync('server/test/fixtures/red.png').toString('base64');

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

test('keeps an image pasted into the description, even when the task is closed right away', async ({
  page,
}) => {
  await signUp(page, 'Image Keeper');
  const { key } = await createProject(page, 'Images');
  const task = await createTask(page, key, { title: 'Screenshot the bug' });
  await page.goto(`/p/${key}/list?task=${task.identifier}`);
  let releaseUpload!: () => void;
  const uploadHeld = new Promise<void>((resolve) => (releaseUpload = resolve));
  await page.route(`**/api/tasks/${task.id}/attachments`, async (route) => {
    await uploadHeld;
    await route.continue();
  });

  const description = page.getByRole('textbox', { name: 'Description' });
  await description.click();
  await description.evaluate((element, base64) => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], 'shot.png'));
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, SCREENSHOT);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveCount(0);
  releaseUpload();

  await expect
    .poll(
      async () =>
        (await apiGet<{ task: { description: string } }>(page, `/tasks/${task.id}`)).task.description,
    )
    .toMatch(/^!\[shot\.png\]\(\/api\/attachments\/[\w-]+\)/);
  await page.goto(`/p/${key}/${task.number}`);
  const image = page.getByRole('region', { name: 'Description' }).locator('img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});
