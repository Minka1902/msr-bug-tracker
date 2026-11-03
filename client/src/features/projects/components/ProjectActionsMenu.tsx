import { FolderGit2, Globe, Link2, MoreHorizontal, Settings, Star, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { can } from '@msr/shared/permissions';
import type { ProjectDetail } from '@msr/shared/types';
import { IconButton } from '../../../components/ui/IconButton';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { useShell } from '../../../hooks/useShell';
import { copyText } from '../../../lib/clipboard';
import { useToggleFavorite } from '../api';

interface ProjectActionsMenuProps {
  project: ProjectDetail;
  trigger?: ReactNode;
  extraItems?: MenuItem[];
  align?: 'start' | 'center' | 'end';
}

export function ProjectActionsMenu({ project, trigger, extraItems = [], align }: ProjectActionsMenuProps) {
  const openLink = (url: string) => window.open(url, '_blank', 'noopener');

  const navigate = useNavigate();
  const { openInvite } = useShell();
  const favorite = useToggleFavorite();
  const base = `/p/${project.key}`;

  return (
    <Menu
      title={project.name}
      align={align}
      trigger={trigger ?? <IconButton icon={<MoreHorizontal />} label="Project actions" />}
      items={[
        {
          label: project.isFavorite ? 'Remove from favorites' : 'Add to favorites',
          icon: <Star />,
          onSelect: () => favorite.mutate({ key: project.key, favorite: !project.isFavorite }),
        },
        {
          label: 'Copy link',
          icon: <Link2 />,
          onSelect: () => copyText(new URL(base, window.location.origin).href, 'Link'),
        },
        {
          label: 'Invite people',
          icon: <UserPlus />,
          hidden: project.isArchived || !can(project.permissions, 'project.manage_members'),
          onSelect: () => openInvite(project),
        },
        {
          label: 'Open live site',
          icon: <Globe />,
          hidden: !project.liveUrl,
          onSelect: () => openLink(project.liveUrl!),
        },
        {
          label: 'Open repository',
          icon: <FolderGit2 />,
          hidden: !project.repoUrl,
          onSelect: () => openLink(project.repoUrl!),
        },
        ...extraItems,
        { type: 'separator' },
        { label: 'Settings', icon: <Settings />, onSelect: () => navigate(`${base}/settings`) },
      ]}
    />
  );
}
