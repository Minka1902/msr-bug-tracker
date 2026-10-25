import { describe, expect, it } from 'vitest';
import { branchName, formatIdentifier, parseIdentifier, PROJECT_KEY_REGEX, suggestProjectKey } from '../src/identifiers';

describe('identifiers', () => {
  it('formats and parses task identifiers', () => {
    expect(formatIdentifier('web', 101)).toBe('WEB-101');
    expect(parseIdentifier(' web-101 ')).toEqual({ key: 'WEB', number: 101 });
    expect(parseIdentifier('WEB101')).toBeNull();
    expect(parseIdentifier('1WEB-3')).toBeNull();
  });

  it('suggests valid project keys', () => {
    for (const name of ['Website Redesign', 'Payments', 'a', '42 Mobile app', 'Ünïcode Prøject', '']) {
      expect(suggestProjectKey(name)).toMatch(PROJECT_KEY_REGEX);
    }
    expect(suggestProjectKey('Website Redesign')).toBe('WR');
    expect(suggestProjectKey('Payments')).toBe('PYM');
  });

  it('builds git branch names', () => {
    expect(branchName('WEB', 101, 'Login crashes on Safari 17!')).toBe('web-101-login-crashes-on-safari-17');
    const long = branchName('WEB', 1, 'x'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
  });
});
