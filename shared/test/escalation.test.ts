import { describe, expect, it } from 'vitest';
import { describeEscalation, escalatedPriority, escalationSteps } from '../src/escalation';
import { createTaskSchema, updateTaskSchema } from '../src/schemas/task';

const RANGE = { from: 'low', to: 'urgent' } as const;

describe('escalationSteps', () => {
  it('gives every level an equal share of the window', () => {
    expect(escalationSteps(RANGE, '2026-11-01', '2026-11-10')).toEqual([
      { priority: 'low', from: '2026-11-01' },
      { priority: 'medium', from: '2026-11-04' },
      { priority: 'high', from: '2026-11-06' },
      { priority: 'urgent', from: '2026-11-08' },
    ]);
  });

  it('steps down when the end priority is lower', () => {
    expect(
      escalationSteps({ from: 'urgent', to: 'low' }, '2026-11-01', '2026-11-10').map((step) => step.priority),
    ).toEqual(['urgent', 'high', 'medium', 'low']);
  });

  it('reaches the end priority on the due date when the window is too short for every level', () => {
    expect(escalationSteps(RANGE, '2026-11-02', '2026-11-02')).toEqual([
      { priority: 'urgent', from: '2026-11-02' },
    ]);
    expect(escalationSteps(RANGE, '2026-11-01', '2026-11-02')).toEqual([
      { priority: 'low', from: '2026-11-01' },
      { priority: 'urgent', from: '2026-11-02' },
    ]);
  });

  it('starts on the due date when the first day is after it', () => {
    expect(escalationSteps({ from: 'low', to: 'high' }, '2026-11-20', '2026-11-10')).toEqual([
      { priority: 'high', from: '2026-11-10' },
    ]);
  });
});

describe('escalatedPriority', () => {
  it('holds the start priority before the window and the end priority from the due date on', () => {
    expect(escalatedPriority(RANGE, '2026-11-01', '2026-11-10', '2026-10-30')).toBe('low');
    expect(escalatedPriority(RANGE, '2026-11-01', '2026-11-10', '2026-11-05')).toBe('medium');
    expect(escalatedPriority(RANGE, '2026-11-01', '2026-11-10', '2026-11-10')).toBe('urgent');
    expect(escalatedPriority(RANGE, '2026-11-01', '2026-11-10', '2026-12-01')).toBe('urgent');
  });
});

describe('describeEscalation', () => {
  it('names both ends', () => {
    expect(describeEscalation(RANGE)).toBe('Low → Urgent');
    expect(describeEscalation(null)).toBeNull();
  });
});

describe('escalation schema', () => {
  it('needs a due date and two different priorities', () => {
    expect(createTaskSchema.safeParse({ title: 'x', escalation: RANGE }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'x', escalation: RANGE, dueDate: '2026-11-10' }).success).toBe(
      true,
    );
    expect(updateTaskSchema.safeParse({ escalation: { from: 'low', to: 'low' } }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ escalation: null }).success).toBe(true);
  });
});
