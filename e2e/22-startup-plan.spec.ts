import { createHash, randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { apiGet, apiPost, signUp, subscribe, uniqueKey } from './helpers';

const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

const connectWorker = async (page: Page, name: string) => {
  const client = await (
    await page.request.post('/oauth/register', {
      data: { client_name: 'Claude', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' },
    })
  ).json();
  const verifier = randomBytes(32).toString('base64url');
  const consent = await page.request.get(
    `/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      scope: 'read write',
    })}`,
    { maxRedirects: 0 },
  );
  const request = new URL(consent.headers().location!).searchParams.get('request');
  const { redirectUrl } = await apiPost<{ redirectUrl: string }>(page, '/connector/authorize', {
    request,
    approve: true,
    scopes: ['read', 'write'],
  });
  await page.request.post('/oauth/token', {
    form: {
      grant_type: 'authorization_code',
      code: new URL(redirectUrl).searchParams.get('code')!,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
      client_id: client.client_id,
    },
  });
  const { apps } = await apiGet<{ apps: { id: string }[] }>(page, '/me/connections');
  await apiPost(page, '/me/agents', { grantId: apps[0]!.id, name });
};

test('a new startup without an AI key goes to the AI worker to plan', async ({ page }) => {
  const owner = await signUp(page, 'Startup Founder');
  await subscribe(page, 'pro');
  await connectWorker(page, 'Claude worker');
  const key = uniqueKey();

  await page.goto('/projects');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('radio', { name: /Startup/ }).click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Plan it for me: steps, features and decisions' }),
  ).toBeChecked();
  await expect(dialog.getByText(/Claude worker plans it the next time it runs/)).toBeVisible();
  await dialog.locator('#project-name').fill('Meal planner');
  await dialog.locator('#project-key').fill(key);
  await dialog.locator('#project-description').fill('Plans a week of dinners from what is in the fridge');
  await dialog.getByRole('button', { name: 'Create & plan' }).click();

  await expect(page).toHaveURL(new RegExp(`/p/${key}/`));
  await expect(page.getByText('Claude worker will plan Meal planner the next time it runs')).toBeVisible();
  const { items } = await apiGet<{
    items: {
      identifier: string;
      title: string;
      assignee: { name: string } | null;
      labels: { name: string }[];
    }[];
  }>(page, `/projects/${key}/tasks`);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    title: 'Plan this project: steps, features and decisions',
    assignee: { name: 'Claude worker' },
    labels: [{ name: 'AI' }],
  });
  const { task } = await apiGet<{ task: { description: string } }>(
    page,
    `/tasks/by-identifier/${items[0]!.identifier}`,
  );
  expect(task.description).toContain('Plans a week of dinners from what is in the fridge');
  expect(task.description).toContain(owner.name);
});
