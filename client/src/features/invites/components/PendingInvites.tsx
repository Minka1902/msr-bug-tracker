import { Link2, Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { IconButton } from '../../../components/ui/IconButton';
import { errorMessage } from '../../../lib/api';
import { formatShortDate } from '../../../lib/dates';
import { useProjectInvites, useRevokeInvite } from '../api';

interface PendingInvitesProps {
  projectKey: string;
}

export function PendingInvites({ projectKey }: PendingInvitesProps) {
  const invites = useProjectInvites(projectKey);
  const revoke = useRevokeInvite(projectKey);

  if (!invites.data?.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Pending invites</h3>
      <ul className="flex flex-col divide-y divide-border">
        {invites.data.map((invite) => (
          <li key={invite.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted [&>svg]:size-4">
              {invite.email ? <Mail /> : <Link2 />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{invite.email ?? 'Invite link'}</p>
              <p className="truncate text-xs text-muted">
                {invite.maxUses === null ? `${invite.uses} joined` : `${invite.uses}/${invite.maxUses} used`} · by{' '}
                {invite.inviterName} · expires {formatShortDate(invite.expiresAt)}
              </p>
            </div>
            {invite.roleName && <Badge label={invite.roleName} />}
            <IconButton
              icon={<X />}
              label={`Revoke ${invite.email ?? 'invite link'}`}
              loading={revoke.isPending && revoke.variables === invite.id}
              onClick={() =>
                revoke.mutate(invite.id, {
                  onSuccess: () => toast.success('Invite revoked'),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
