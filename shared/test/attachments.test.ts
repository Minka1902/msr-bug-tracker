import { describe, expect, it } from 'vitest';
import { fileDeletesAt } from '../src/attachments';

describe('attachment retention', () => {
  it('deletes a file 7 days after the card is done, or after its upload when that came later', () => {
    expect(fileDeletesAt('2026-11-01T10:00:00.000Z', '2026-10-20T08:00:00.000Z')).toBe(
      '2026-11-08T10:00:00.000Z',
    );
    expect(fileDeletesAt('2026-11-01T10:00:00.000Z', '2026-11-05T09:30:00.000Z')).toBe(
      '2026-11-12T09:30:00.000Z',
    );
  });
});
