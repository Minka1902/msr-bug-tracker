import { describe, expect, it } from 'vitest';
import { describeRecurrence, nextAssignee, nextOccurrence } from '../src/recurrence';

describe('nextOccurrence', () => {
  it('steps from the due date and keeps the schedule', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 1 }, '2026-11-02', '2026-10-31')).toBe('2026-11-09');
    expect(nextOccurrence({ freq: 'daily', interval: 2 }, '2026-11-02', '2026-11-02')).toBe('2026-11-04');
  });

  it('skips past dates when a chore is completed late', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-10-20', '2026-10-26')).toBe('2026-10-27');
    expect(nextOccurrence({ freq: 'weekly', interval: 1 }, '2026-10-05', '2026-10-26')).toBe('2026-11-02');
  });

  it('starts from today without a due date and clamps month ends', () => {
    expect(nextOccurrence({ freq: 'monthly', interval: 1 }, null, '2026-10-26')).toBe('2026-11-26');
    expect(nextOccurrence({ freq: 'monthly', interval: 1 }, '2027-01-31', '2027-01-15')).toBe('2027-02-28');
    expect(nextOccurrence({ freq: 'monthly', interval: 12 }, '2028-02-29', '2028-02-01')).toBe('2029-02-28');
  });
});

describe('nextAssignee', () => {
  it('rotates through the list and keeps the assignee without one', () => {
    expect(nextAssignee({ rotate: ['a', 'b', 'c'] }, 'b')).toBe('c');
    expect(nextAssignee({ rotate: ['a', 'b', 'c'] }, 'c')).toBe('a');
    expect(nextAssignee({ rotate: ['a', 'b'] }, 'z')).toBe('a');
    expect(nextAssignee({ rotate: [] }, 'z')).toBe('z');
  });
});

it('describes a rule', () => {
  expect(describeRecurrence({ freq: 'weekly', interval: 1 })).toBe('Every week');
  expect(describeRecurrence({ freq: 'daily', interval: 3 })).toBe('Every 3 days');
});
