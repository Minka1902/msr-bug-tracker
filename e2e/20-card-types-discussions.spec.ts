import { expect, test } from '@playwright/test';
import { apiGet, createProject, createTask, signUp } from './helpers';

test('adds a custom card type and uses it on a card', async ({ page }) => {
  await signUp(page, 'Founder');
  const { key } = await createProject(page, 'Launch', undefined, 'startup');
  const task = await createTask(page, key, { title: 'Test the pricing page' });

  await page.goto(`/p/${key}/settings/card-types`);
  await page.getByRole('button', { name: 'Add card type' }).click();
  const editor = page.getByRole('dialog', { name: 'New card type' });
  await editor.getByLabel('Name').fill('Experiment');
  await expect(
    editor.getByRole('group', { name: 'Who can create them' }).getByRole('checkbox', { name: 'Owner' }),
  ).toBeDisabled();
  await editor
    .getByRole('group', { name: 'Who can create them' })
    .getByRole('checkbox', { name: 'Member' })
    .click();
  await editor.getByRole('radio', { name: 'Chosen roles' }).click();
  const viewers = editor.getByRole('group', { name: 'Who can see them' });
  await expect(viewers.getByRole('checkbox', { name: 'Admin' })).toBeChecked();
  await viewers.getByRole('checkbox', { name: 'Member' }).click();
  await expect(
    editor
      .getByRole('group', { name: 'Who can edit and move them' })
      .getByRole('checkbox', { name: 'Member' }),
  ).not.toBeChecked();
  await editor.getByRole('button', { name: 'Add card type' }).click();
  await expect(page.getByText('Works like Task · See: Owner, Admin · Create: Owner, Admin ·')).toBeVisible();

  await page.goto(`/p/${key}/${task.number}`);
  await page
    .getByRole('button', { name: `Type of ${task.identifier}` })
    .first()
    .click();
  await page.getByRole('option', { name: /Experiment/ }).click();
  await expect(
    page.getByRole('button', { name: `Type of ${task.identifier}: Experiment` }).first(),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await apiGet<{ task: { cardType: { name: string } | null } }>(page, `/tasks/${task.id}`)).task
          .cardType?.name,
    )
    .toBe('Experiment');

  await page.goto(`/p/${key}/board`);
  await expect(page.getByRole('img', { name: 'Experiment' }).first()).toBeVisible();
});

test('asks for the decision when a discussion is closed', async ({ page }) => {
  await signUp(page, 'Parent');
  const { key } = await createProject(page, 'Launch', undefined, 'startup');
  const task = await createTask(page, key, { title: 'Which payment provider?', type: 'discussion' });

  await page.goto(`/p/${key}/list`);
  await page.getByRole('button', { name: `Status of ${task.identifier}` }).click();
  await page.getByRole('option', { name: 'Done' }).click();
  const prompt = page.getByRole('dialog', { name: `Close ${task.identifier}` });
  await prompt.getByLabel('What was decided?').fill('Stripe, for the lower fees');
  await prompt.getByRole('button', { name: 'Close discussion' }).click();
  await expect(page.getByRole('button', { name: `Status of ${task.identifier}: Done` })).toBeVisible();

  await page.goto(`/p/${key}/${task.number}`);
  await expect(
    page.getByRole('region', { name: 'Decision' }).getByText('Stripe, for the lower fees'),
  ).toBeVisible();

  await createTask(page, key, { title: 'Which domain?', type: 'discussion' });
  await page.goto(`/p/${key}`);
  await page.getByRole('link', { name: 'Conclusions' }).click();
  const decision = page.getByRole('article', { name: 'Which payment provider?' });
  await expect(decision.getByText('Stripe, for the lower fees')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Waiting for a decision (1)' })
      .getByRole('button', { name: /Which domain\?/ }),
  ).toBeVisible();
  await page.getByLabel('Search decisions').fill('nothing like this');
  await expect(page.getByText('No decisions match')).toBeVisible();
});

test('saves AI instructions for the project', async ({ page }) => {
  await signUp(page, 'Owner');
  const { key } = await createProject(page, 'Assistants');
  await page.goto(`/p/${key}/settings/ai`);
  await page.getByLabel('Before you start').fill('Move a task to In Progress before you work on it.');
  await page.getByLabel('When you finish').fill('Create a task assigned to me for anything I need to do.');
  await page.getByRole('button', { name: 'Save instructions' }).click();
  await expect(page.getByText('AI instructions saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('When you finish')).toHaveValue(
    'Create a task assigned to me for anything I need to do.',
  );
});
