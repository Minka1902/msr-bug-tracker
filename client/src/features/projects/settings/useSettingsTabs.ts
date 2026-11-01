import { can } from '@msr/shared/permissions';
import type { ProjectDetail, ProjectSummary } from '@msr/shared/types';
import { useAppConfig } from '../../demo/api';
import { useTelegramSettings } from '../../telegram/api';

type TabProject = Pick<ProjectSummary, 'permissions' | 'isOwner' | 'isArchived' | 'memberCount'> &
  Partial<Pick<ProjectDetail, 'cardTypesAllowed'>>;

export interface SettingsTab {
  path: string;
  label: string;
  count?: number;
}

export const settingsTabs = (project: TabProject, telegram: boolean): SettingsTab[] => {
  const mask = project.isArchived ? 0 : project.permissions;
  return [
    can(mask, 'project.edit') && { path: 'general', label: 'General' },
    can(mask, 'project.manage_workflow') && { path: 'workflows', label: 'Workflows' },
    can(mask, 'project.manage_workflow') &&
      (project.cardTypesAllowed || project.isOwner) && { path: 'card-types', label: 'Card types' },
    can(mask, 'project.manage_labels') && { path: 'labels', label: 'Labels' },
    can(mask, 'project.manage_members') && { path: 'members', label: 'Members', count: project.memberCount },
    can(mask, 'project.manage_roles') && { path: 'roles', label: 'Roles' },
    can(mask, 'project.edit') && { path: 'ai', label: 'AI instructions' },
    telegram && { path: 'telegram', label: 'Telegram' },
    { path: 'danger', label: 'Danger zone' },
  ].filter((tab): tab is SettingsTab => !!tab);
};

export const useSettingsTabs = (project: TabProject & Pick<ProjectSummary, 'key'>) => {
  const config = useAppConfig();
  const bot = !!config.data?.features.telegram && !project.isArchived;
  const telegram = useTelegramSettings(project.key, bot && !project.isOwner);

  return {
    pending: config.isPending || telegram.isLoading,
    tabs: settingsTabs(project, bot && (project.isOwner || !!telegram.data?.allowed)),
  };
};
