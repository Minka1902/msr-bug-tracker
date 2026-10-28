import { describe, expect, it } from 'vitest';
import { formatMinutes } from '../dates';

describe('formatMinutes', () => {
  it('reads like a duration or reminder', () => {
    expect([15, 60, 90, 120, 1440, 2880, 1500].map(formatMinutes)).toEqual([
      '15 min',
      '1 h',
      '1 h 30 min',
      '2 h',
      '1 day',
      '2 days',
      '25 h',
    ]);
  });
});
