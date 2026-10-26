import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-1';

let sequence = 0;

export const uniqueEmail = (label = 'user') =>
  `${label}-${Date.now().toString(36)}-${process.pid}-${(sequence += 1)}@e2e.test`;

export const uniqueKey = () =>
  `E${Array.from(crypto.getRandomValues(new Uint8Array(5)), (byte) => (byte % 36).toString(36)).join('')}`.toUpperCase();

const json = async <T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> => {
  expect(response.ok(), `${response.url()} → ${response.status()} ${await response.text()}`).toBe(true);
  return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const apiPost = async <T = unknown>(page: Page, path: string, data?: unknown) =>
  json<T>(await page.request.post(`/api${path}`, { data }));

export const apiPatch = async <T = unknown>(page: Page, path: string, data?: unknown) =>
  json<T>(await page.request.patch(`/api${path}`, { data }));

export const apiGet = async <T = unknown>(page: Page, path: string) =>
  json<T>(await page.request.get(`/api${path}`));

export const mailLink = async (page: Page, email: string, path: string) => {
  const { messages } = await apiGet<{ messages: { text: string }[] }>(
    page,
    `/dev/mailbox?to=${encodeURIComponent(email)}`,
  );
  const match = messages
    .map((mail) => mail.text.match(new RegExp(`(${path}\\?token=[\\w-]+)`)))
    .find(Boolean);
  expect(match, `no ${path} mail for ${email}`).toBeTruthy();
  return match![1]!;
};

export const signUp = async (page: Page, name = 'E2E User', label = 'user') => {
  const email = uniqueEmail(label);
  const { user } = await apiPost<{ user: { id: string } }>(page, '/auth/register', {
    name,
    email,
    password: PASSWORD,
  });
  const link = await mailLink(page, email, '/verify-email');
  await apiPost(page, '/auth/verify-email', { token: new URL(link, 'http://x').searchParams.get('token') });
  return { id: user.id, email, name };
};

export const createProject = async (
  page: Page,
  name: string,
  key = uniqueKey(),
  kind: 'software' | 'household' = 'software',
) => {
  const { project } = await apiPost<{
    project: { id: string; key: string; roles: { id: string; systemKey: string | null }[] };
  }>(page, '/projects', { name, key, kind, description: '', color: '#4f56f0', icon: 'folder' });
  return project;
};

export const isoDay = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export interface TaskSeed {
  title: string;
  type?: 'task' | 'bug' | 'feature' | 'improvement' | 'chore' | 'errand';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  statusId?: string;
  assigneeId?: string | null;
  parentId?: string;
}

export const createTask = async (page: Page, projectKey: string, seed: TaskSeed) =>
  (
    await apiPost<{ task: { id: string; identifier: string; number: number } }>(
      page,
      `/projects/${projectKey}/tasks`,
      seed,
    )
  ).task;

export const projectStatuses = async (page: Page, projectKey: string) =>
  (
    await apiGet<{
      project: { statuses: { id: string; name: string; workflow: string; category: string }[] };
    }>(page, `/projects/${projectKey}`)
  ).project.statuses;
