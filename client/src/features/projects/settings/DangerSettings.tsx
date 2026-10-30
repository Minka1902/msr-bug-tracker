import { Archive, ArchiveRestore, LogOut, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { can } from '@msr/shared/permissions';
import { Button } from '../../../components/ui/Button';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useArchiveProject, useDeleteProject, useRemoveMember } from '../api';
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

  const leaveProject = async () => {
    const confirmed = await confirm({
      title: 'Leave this project?',
      description: 'You will lose access immediately. Open tasks assigned to you become unassigned.',
      confirmLabel: 'Leave project',
    });
    if (confirmed) leave.mutate(user.id, { onSuccess: () => navigate('/projects'), onError });
  };

  const project = useProjectContext();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const archive = useArchiveProject(project.key);
  const remove = useDeleteProject(project.key);
  const leave = useRemoveMember(project.key);

  return (
    <div className="flex flex-col gap-4">
      {can(project.permissions, 'project.archive') && (
        <SettingsSection
          title={project.isArchived ? 'Restore project' : 'Archive project'}
          description="Archived projects are read-only and hidden from lists."
        >
          <Button
            variant="secondary"
            leftIcon={project.isArchived ? <ArchiveRestore /> : <Archive />}
            loading={archive.isPending}
            onClick={toggleArchive}
          >
            {project.isArchived ? 'Restore project' : 'Archive project'}
          </Button>
        </SettingsSection>
      )}
      {project.isOwner ? (
        <SettingsSection title="Delete project" description="Only the owner can delete a project.">
          <Button variant="danger" leftIcon={<Trash2 />} loading={remove.isPending} onClick={deleteProject}>
            Delete project
          </Button>
        </SettingsSection>
      ) : (
        <SettingsSection
          title="Leave project"
          description="You lose access to it, and its open tasks assigned to you become unassigned."
        >
          <Button variant="danger" leftIcon={<LogOut />} loading={leave.isPending} onClick={leaveProject}>
            Leave project
          </Button>
        </SettingsSection>
      )}
    </div>
  );
}
