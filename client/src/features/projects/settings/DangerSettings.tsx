import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { can } from '@msr/shared/permissions';
import { Button } from '../../../components/ui/Button';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useArchiveProject, useDeleteProject } from '../api';
import { useProjectContext } from '../useProjectContext';

const onError = (error: unknown) => toast.error(errorMessage(error));

export function DangerSettings() {
  const toggleArchive = async () => {
    if (
      !project.isArchived &&
      !(await confirm({
        title: 'Archive this project?',
        description: 'It becomes read-only and is hidden from your lists. You can restore it any time.',
        confirmLabel: 'Archive',
        tone: 'primary',
      }))
    )
      return;
    archive.mutate(!project.isArchived, {
      onSuccess: () => toast.success(project.isArchived ? 'Project restored' : 'Project archived'),
      onError,
    });
  };

  const deleteProject = async () => {
    const confirmed = await confirm({
      title: `Delete ${project.name}?`,
      description: `This permanently deletes ${project.stats.total} tasks with their comments and files. This can't be undone.`,
      confirmLabel: 'Delete forever',
      requireText: project.key,
    });
    if (!confirmed) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Project deleted');
        navigate('/projects');
      },
      onError,
    });
  };

  const project = useProjectContext();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const archive = useArchiveProject(project.key);
  const remove = useDeleteProject(project.key);

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title={project.isArchived ? 'Restore project' : 'Archive project'}
        description="Archived projects are read-only and hidden from lists."
      >
        <Button
          variant="secondary"
          leftIcon={project.isArchived ? <ArchiveRestore /> : <Archive />}
          disabled={!can(project.permissions, 'project.archive')}
          loading={archive.isPending}
          onClick={toggleArchive}
        >
          {project.isArchived ? 'Restore project' : 'Archive project'}
        </Button>
      </SettingsSection>
      <SettingsSection title="Delete project" description="Only the owner can delete a project.">
        <Button
          variant="danger"
          leftIcon={<Trash2 />}
          disabled={!project.isOwner}
          loading={remove.isPending}
          onClick={deleteProject}
        >
          Delete project
        </Button>
      </SettingsSection>
    </div>
  );
}
