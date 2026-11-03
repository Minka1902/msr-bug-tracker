import { describe, expect, it } from 'vitest';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import { groupTasks } from '../groupTasks';

const project = {
  module: 'software',
  memberList: [{ id: 'u1', name: 'Dana', avatarUrl: null }],
  labels: [{ id: 'l1', name: 'Frontend', color: '#112233' }],
  cardTypes: [{ id: 'c1', name: 'Experiment', icon: 'flask', color: '#445566', base: 'task' }],
} as unknown as ProjectDetail;

const card = (overrides: Partial<TaskCard>) =>
  ({
    type: 'task',
    cardType: null,
    priority: 'high',
    assignee: null,
    labels: [],
    ...overrides,
  }) as TaskCard;

const tasks = [
  card({ assignee: { id: 'u1', name: 'Dana', avatarUrl: null }, labels: [project.labels[0]!] }),
  card({ type: 'bug', priority: 'low' }),
  card({ cardType: { id: 'c1', name: 'Experiment', icon: 'flask', color: '#445566' } }),
];

const defaultsOf = (groupBy: Parameters<typeof groupTasks>[1]) =>
  Object.fromEntries(groupTasks(tasks, groupBy, project).map((lane) => [lane.key, lane.defaults]));

describe('board lanes', () => {
  it('preset a new task with the lane it is created from', () => {
    expect(defaultsOf('priority')).toMatchObject({ high: { priority: 'high' }, low: { priority: 'low' } });
    expect(defaultsOf('assignee')).toEqual({ u1: { assigneeId: 'u1' }, none: { assigneeId: null } });
    expect(defaultsOf('label')).toEqual({ l1: { labelIds: ['l1'] }, none: {} });
    expect(defaultsOf('type')).toEqual({
      task: { type: 'task', cardTypeId: null },
      bug: { type: 'bug', cardTypeId: null },
      c1: { type: 'task', cardTypeId: 'c1' },
    });
    expect(defaultsOf('none')).toEqual({ all: {} });
  });
});
