import { ChevronDown, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router';
import { IconButton } from '../../../components/ui/IconButton';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { useProjects } from '../api';

const ALL_PROJECTS = '__all__';

export function ProjectSwitcher({ currentKey }: { currentKey: string }) {
  const navigate = useNavigate();
  const projects = useProjects();

  return (
    <OptionPicker
      aria-label="Switch project"
      value={currentKey}
      onChange={(key) => key && navigate(key === ALL_PROJECTS ? '/projects' : `/p/${key}`)}
      searchable
      searchPlaceholder="Jump to project…"
      options={[
        ...(projects.data ?? []).map((project) => ({
          value: project.key,
          label: project.name,
          keywords: [project.key],
          description: project.key,
          icon: <ProjectAvatar color={project.color} icon={project.icon} size="xs" />,
        })),
        { value: ALL_PROJECTS, label: 'All projects', icon: <FolderKanban />, group: ' ' },
      ]}
      renderTrigger={() => <IconButton icon={<ChevronDown />} label="Switch project" />}
    />
  );
}
