import { createHash, randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { apiGet, createProject, PASSWORD, signUp } from './helpers';

const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

test('connects Claude through sign-in and consent, then creates a task over MCP', async ({
  page,
  browser,
}) => {
  const owner = await signUp(page, 'Connector Owner');
  const project = await createProject(page, 'Connector Project');
  await page.request.post('/api/auth/logout');

  const client = await (
    await page.request.post('/register', {
      data: { client_name: 'Claude', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' },
    })
  ).json();
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const guest = await (await browser.newContext()).newPage();
  await guest.route('https://claude.ai/**', (route) => route.fulfill({ body: 'connected' }));
  await guest.goto(
    `/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'e2e-state',
      scope: 'read write',
    })}`,
  );
  await guest.getByRole('link', { name: 'Sign in' }).click();
  await guest.locator('#email').fill(owner.email);
  await guest.locator('#password').fill(PASSWORD);
  await guest.getByRole('button', { name: 'Sign in' }).click();

  await expect(guest.getByRole('heading', { name: 'Connect Claude' })).toBeVisible();
  await expect(guest.getByText('claude.ai', { exact: true })).toBeVisible();
  await expect(guest.getByRole('radio', { name: /Read and write/ })).toHaveAttribute('aria-checked', 'true');
  await guest.getByRole('button', { name: 'Allow' }).click();
  await guest.waitForURL(/^https:\/\/claude\.ai\//);
  const callback = new URL(guest.url());
  expect(callback.searchParams.get('state')).toBe('e2e-state');

  const tokens = await (
    await guest.request.post('/token', {
      form: {
        grant_type: 'authorization_code',
        code: callback.searchParams.get('code')!,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
        client_id: client.client_id,
      },
    })
  ).json();
  expect(tokens.scope).toBe('read write');

  const response = await guest.request.post('/mcp', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/json, text/event-stream',
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'create_task', arguments: { projectKey: project.key, title: 'Made by Claude' } },
    },
  });
  const created = JSON.parse((await response.json()).result.content[0].text);
  expect(created.task.title).toBe('Made by Claude');

  const { items } = await apiGet<{ items: { title: string }[] }>(guest, `/projects/${project.key}/tasks`);
  expect(items.map((task) => task.title)).toContain('Made by Claude');

  await guest.goto('/settings/connected-apps');
  await expect(guest.getByText('Read and write')).toBeVisible();
  await guest.getByRole('button', { name: 'Disconnect' }).click();
  await guest.getByRole('alertdialog').getByRole('button', { name: 'Disconnect' }).click();
  await expect(guest.getByText('No apps connected')).toBeVisible();
  await guest.context().close();
});
