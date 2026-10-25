import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../safeNextPath';

describe('safeNextPath', () => {
  it('keeps in-app paths with query and hash', () => {
    expect(safeNextPath('/p/WEB/board?task=WEB-1#c')).toBe('/p/WEB/board?task=WEB-1#c');
  });

  it.each([
    null,
    '',
    'projects',
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('falls back to the dashboard for %j', (value) => {
    expect(safeNextPath(value)).toBe('/');
  });
});
