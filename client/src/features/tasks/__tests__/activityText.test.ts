import type { ActivityEntry } from '@msr/shared/types';
import { describe, expect, it } from 'vitest';
import { activityText } from '../activityText';

const entry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: 1,
  action: 'updated',
  field: null,
  oldValue: null,
  newValue: null,
  actor: null,
  task: null,
  project: { key: 'WEB', name: 'Website', color: '#4f56f0' },
  createdAt: '2026-10-26T10:00:00.000Z',
  ...overrides,
});

describe('activityText', () => {
  it('explains a due date that carried over, and the switch itself', () => {
    expect(
      activityText(
        entry({ action: 'carried_over', field: 'dueDate', oldValue: '2030-05-10', newValue: '2030-05-11' }),
      ),
    ).toBe("moved the due date from 2030-05-10 to 2030-05-11 because it isn't done yet");
    expect(activityText(entry({ field: 'carryOver', oldValue: true, newValue: false }))).toBe(
      'changed carry over from yes to no',
    );
  });

  it('says which way the priority schedule moved the priority', () => {
    expect(
      activityText(entry({ action: 'escalated', field: 'priority', oldValue: 'low', newValue: 'high' })),
    ).toBe('raised the priority from low to high');
    expect(
      activityText(entry({ action: 'escalated', field: 'priority', oldValue: 'urgent', newValue: 'medium' })),
    ).toBe('lowered the priority from urgent to medium');
  });

  it('names the priority schedule when it is set or turned off', () => {
    expect(activityText(entry({ field: 'escalation', newValue: 'Low → Urgent' }))).toBe(
      'changed priority schedule from none to Low → Urgent',
    );
    expect(activityText(entry({ field: 'escalation', oldValue: 'Low → Urgent' }))).toBe(
      'changed priority schedule from Low → Urgent to none',
    );
  });
});
