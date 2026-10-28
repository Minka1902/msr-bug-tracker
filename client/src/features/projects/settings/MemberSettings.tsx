import { Bot, Link2, LogOut, UserMinus, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { isSubsetOf } from '@msr/shared/permissions';
import type { ProjectMember } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useShell } from '../../../hooks/useShell';
import { ApiError, errorMessage } from '../../../lib/api';
import { formatShortDate } from '../../../lib/dates';
import { AddWorkerDialog } from '../../agents/components/AddWorkerDialog';
import { PendingInvites } from '../../invites/components/PendingInvites';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useAddMember, useChangeMemberRole, useRemoveMember } from '../api';
import { useProjectContext } from '../useProjectContext';
import { useProjectPermissions } from '../useProjectPermissions';

const onError = (error: unknown) => toast.error(errorMessage(error));

export function MemberSettings() {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !newRoleId) return;
    add.mutate(
      { email: email.trim(), roleId: newRoleId },
      {
        onSuccess: ({ member }) => {
          setEmail('');
          toast.success(`${member.name} joined the project`);
        },
        onError: (error) =>
          error instanceof ApiError && error.status === 404
            ? toast.info(`${email.trim()} doesn't have an account yet`, {
                action: {
                  label: 'Send invite',
                  onClick: () => openInvite({ ...project, email: email.trim() }),
                },
              })
            : onError(error),
      },
    );
  };

  const removeMember = async (member: ProjectMember) => {
    const leaving = member.id === user.id;
    const confirmed = await confirm({
      title: leaving ? 'Leave this project?' : `Remove ${member.name}?`,
      description: `${leaving ? 'You' : 'They'} will lose access immediately. Open tasks assigned to ${leaving ? 'you' : 'them'} become unassigned.`,
      confirmLabel: leaving ? 'Leave project' : 'Remove member',
    });
    if (!confirmed) return;
    remove.mutate(member.id, { onSuccess: () => leaving && navigate('/projects'), onError });
  };

  const project = useProjectContext();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { openInvite } = useShell();
  const { can, deniedReason } = useProjectPermissions(project);
  const add = useAddMember(project.key);
  const changeRole = useChangeMemberRole(project.key);
  const remove = useRemoveMember(project.key);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [addingWorker, setAddingWorker] = useState(false);
  const manageable = can('project.manage_members');
  const grantable = project.roles.filter(
    (role) => role.systemKey !== 'owner' && isSubsetOf(role.permissions, project.permissions),
  );
  const roleOptions = grantable.map((role) => ({ value: role.id, label: role.name }));
  const newRoleId = roleId ?? grantable.find((role) => role.systemKey === 'member')?.id ?? null;
  const canManage = (member: ProjectMember) =>
    manageable &&
    !member.isOwner &&
    isSubsetOf(
      project.roles.find((role) => role.id === member.roleId)?.permissions ?? 0,
      project.permissions,
    );

  return (
    <SettingsSection
      title="Members"
      description={
        manageable ? 'Add people by email, or invite anyone with a link, QR code or WhatsApp.' : deniedReason
      }
      footer={
        manageable && (
          <>
            <Button variant="secondary" leftIcon={<Link2 />} onClick={() => openInvite(project)}>
              Invite with a link
            </Button>
            <Button variant="secondary" leftIcon={<Bot />} onClick={() => setAddingWorker(true)}>
              Add AI worker
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {manageable && (
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              size="sm"
              wrapperClassName="flex-1"
              aria-label="Email"
            />
            <OptionPicker
              aria-label="Role"
              value={newRoleId}
              onChange={setRoleId}
              options={roleOptions}
              className="h-8 sm:w-36"
            />
            <Button
              type="submit"
              size="sm"
              leftIcon={<UserPlus />}
              loading={add.isPending}
              disabled={!email.trim()}
            >
              Add member
            </Button>
          </form>
        )}
        <div className="flex flex-col divide-y divide-border">
          {project.memberList.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Avatar name={member.name} src={member.avatarUrl} size="md" bot={member.isAgent} decorative />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {member.name}
                  {member.id === user.id && <Badge size="xs" label="You" />}
                  {member.isAgent && <Badge size="xs" tone="violet" icon={<Bot />} label="AI worker" />}
                </p>
                <p className="truncate text-xs text-muted">
                  {member.isAgent ? 'Added' : member.email} · joined {formatShortDate(member.joinedAt)}
                </p>
              </div>
              {member.isOwner ? (
                <Badge tone="accent" label="Owner" />
              ) : (
                <OptionPicker
                  aria-label={`Role of ${member.name}`}
                  value={member.roleId}
                  disabled={!canManage(member)}
                  disabledReason={manageable ? "You can't change this member's role" : deniedReason}
                  onChange={(next) =>
                    next && changeRole.mutate({ userId: member.id, roleId: next }, { onError })
                  }
                  options={
                    canManage(member) ? roleOptions : [{ value: member.roleId, label: member.roleName }]
                  }
                  className="h-8 w-36"
                />
              )}
              {!member.isOwner && member.id === user.id && (
                <IconButton
                  icon={<LogOut />}
                  label="Leave project"
                  variant="danger-ghost"
                  onClick={() => removeMember(member)}
                />
              )}
              {member.id !== user.id && canManage(member) && (
                <IconButton
                  icon={<UserMinus />}
                  label={`Remove ${member.name}`}
                  variant="danger-ghost"
                  onClick={() => removeMember(member)}
                />
              )}
            </div>
          ))}
        </div>
        {manageable && <PendingInvites projectKey={project.key} />}
      </div>
      {addingWorker && <AddWorkerDialog open onOpenChange={setAddingWorker} project={project} />}
    </SettingsSection>
  );
}
