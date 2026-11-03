import { can } from '@msr/shared/permissions';
import type { ProjectDetail, ProjectSummary } from '@msr/shared/types';
import { useAppConfig } from '../../demo/api';
import { useBotSettings } from '../../bots/api';

type TabProject = Pick<ProjectSummary, 'permissions' | 'isOwner' | 'isArchived' | 'memberCount'> &
  Partial<Pick<ProjectDetail, 'cardTypesAllowed'>>;

export interface SettingsTab {
  path: string;
  label: string;
  count?: number;
}

export const settingsTabs = (project: TabProject, bots: boolean): SettingsTab[] => {
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
    bots && { path: 'bots', label: 'Bots' },
    { path: 'danger', label: 'Danger zone' },
  ].filter((tab): tab is SettingsTab => !!tab);
};

export const useSettingsTabs = (project: TabProject & Pick<ProjectSummary, 'key'>) => {
  const config = useAppConfig();
  const bot = !!(config.data?.features.telegram || config.data?.features.discord) && !project.isArchived;
  const bots = useBotSettings(project.key, bot && !project.isOwner);

  return {
    pending: config.isPending || bots.isLoading,
    tabs: settingsTabs(project, bot && (project.isOwner || !!bots.data?.allowed)),
  };
};
