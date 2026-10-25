import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  can,
  DEFAULT_ROLE_PERMISSIONS,
  isSubsetOf,
  maskOf,
  missingTaskPermissions,
  PERMISSION_GROUPS,
  PERMISSIONS,
} from '../src/permissions';

const ME = 'me';
const OTHER = 'other';
const ownTask = { reporterId: ME, assigneeId: null };
const foreignTask = { reporterId: OTHER, assigneeId: OTHER };

describe('permissions', () => {
  it('lists every permission exactly once in the groups', () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped.sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it('uses unique bits that fit a signed int', () => {
    const bits = Object.values(PERMISSIONS);
    expect(new Set(bits).size).toBe(bits.length);
    expect(ALL_PERMISSIONS).toBeLessThan(2 ** 31);
  });

  it('gives viewers nothing and members no admin powers', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.viewer).toBe(0);
    expect(can(DEFAULT_ROLE_PERMISSIONS.member, 'task.create')).toBe(true);
    expect(can(DEFAULT_ROLE_PERMISSIONS.member, 'project.manage_roles')).toBe(false);
  });

  it('detects escalation via subset checks', () => {
    expect(isSubsetOf(maskOf('task.create'), maskOf('task.create', 'task.delete'))).toBe(true);
    expect(isSubsetOf(maskOf('task.delete'), maskOf('task.create'))).toBe(false);
  });

  it('maps patch fields to required permissions', () => {
    const editOwn = maskOf('task.edit_own');
    expect(missingTaskPermissions(editOwn, ownTask, { title: 'x' }, ME)).toEqual([]);
    expect(missingTaskPermissions(editOwn, foreignTask, { title: 'x' }, ME)).toEqual(['task.edit_any']);
    expect(missingTaskPermissions(editOwn, ownTask, { statusId: 's' }, ME)).toEqual(['task.transition']);
    expect(
      missingTaskPermissions(maskOf('task.transition'), foreignTask, { statusId: 's', position: 'a0' }, ME),
    ).toEqual([]);
  });

  it('splits self and others assignment', () => {
    const self = maskOf('task.assign_self');
    expect(missingTaskPermissions(self, ownTask, { assigneeId: ME }, ME)).toEqual([]);
    expect(missingTaskPermissions(self, ownTask, { assigneeId: OTHER }, ME)).toEqual(['task.assign_others']);
    expect(missingTaskPermissions(self, foreignTask, { assigneeId: null }, ME)).toEqual([
      'task.assign_others',
    ]);
    expect(
      missingTaskPermissions(self, { reporterId: OTHER, assigneeId: ME }, { assigneeId: null }, ME),
    ).toEqual([]);
    expect(missingTaskPermissions(maskOf('task.assign_others'), ownTask, { assigneeId: ME }, ME)).toEqual([]);
  });
});
