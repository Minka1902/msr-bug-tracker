import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS, HOUSEHOLD_ROLE_PERMISSIONS } from '@msr/shared/permissions';
import { settingsTabs } from '../useSettingsTabs';

const project = (permissions: number, extra: { isOwner?: boolean; isArchived?: boolean } = {}) => ({
  permissions,
  isOwner: false,
  isArchived: false,
  memberCount: 3,
  ...extra,
});

const paths = (...args: Parameters<typeof settingsTabs>) => settingsTabs(...args).map((tab) => tab.path);

describe('settingsTabs', () => {
  it('gives the owner and admins every tab', () => {
    const all = ['general', 'workflows', 'labels', 'members', 'roles', 'telegram', 'danger'];
    expect(paths(project(DEFAULT_ROLE_PERMISSIONS.owner, { isOwner: true }), true)).toEqual(all);
    expect(paths(project(DEFAULT_ROLE_PERMISSIONS.admin), true)).toEqual(all);
  });

  it('shows a member only what their role can change', () => {
    expect(paths(project(DEFAULT_ROLE_PERMISSIONS.member), false)).toEqual(['labels', 'danger']);
    expect(paths(project(HOUSEHOLD_ROLE_PERMISSIONS.member), true)).toEqual(['telegram', 'danger']);
  });

  it('leaves a viewer only the danger zone, where they can leave', () => {
    expect(paths(project(DEFAULT_ROLE_PERMISSIONS.viewer), false)).toEqual(['danger']);
  });

  it('hides every editing tab in an archived project, even from the owner', () => {
    expect(
      paths(project(DEFAULT_ROLE_PERMISSIONS.owner, { isOwner: true, isArchived: true }), false),
    ).toEqual(['danger']);
  });

  it('counts members on the Members tab', () => {
    expect(settingsTabs(project(DEFAULT_ROLE_PERMISSIONS.admin), false)).toContainEqual({
      path: 'members',
      label: 'Members',
      count: 3,
    });
  });
});
