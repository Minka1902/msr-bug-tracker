import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { apiGet, apiPatch, apiPost, signUp } from './helpers';

const THEMES = [
  { style: 'aurora', mode: 'light' },
  { style: 'aurora', mode: 'dark' },
  { style: 'clean', mode: 'light' },
  { style: 'clean', mode: 'dark' },
] as const;

test('has no WCAG 2 A/AA violations in any theme', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, 'Axe Auditor');
  await apiPost(page, '/demo', { size: 'small', seed: 7 });
  const { projects } = await apiGet<{ projects: { key: string; isArchived: boolean; isOwner: boolean }[] }>(
    page,
    '/projects',
  );
  const key = projects.find((project) => !project.isArchived && project.isOwner)!.key;
  const pages = ['/', '/my-tasks', '/projects', `/p/${key}/board`, `/p/${key}/list`, `/p/${key}/1`];

  for (const theme of THEMES) {
    await apiPatch(page, '/me', { preferences: { ...theme, nav: 'sidebar' } });
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const summary = violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes
            .map((node) => node.target.join(' '))
            .slice(0, 3)
            .join(', ')}`,
      );
      expect(summary, `${theme.style}-${theme.mode} ${path}`).toEqual([]);
    }
  }
});
