import { CircleX, PartyPopper } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { Spinner } from '../../../components/ui/Spinner';
import { errorMessage } from '../../../lib/api';
import { formatShortDate } from '../../../lib/dates';
import { useMe } from '../../auth/api';
import { AuthLayout } from '../../auth/components/AuthLayout';
import { useAcceptInvite, useInvitePreview } from '../api';

export function InvitePage() {
  const accept = () =>
    acceptInvite.mutate(token, {
      onSuccess: ({ projectKey }) => {
        toast.success(projectKey ? `You joined ${preview.data?.project?.name}` : 'Welcome to MSR Tracker');
        navigate(projectKey ? `/p/${projectKey}` : '/', { replace: true });
      },
      onError: (error) => toast.error(errorMessage(error)),
    });

  const { token = '' } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const preview = useInvitePreview(token);
  const acceptInvite = useAcceptInvite();
  const invite = preview.data;
  const here = `/invite/${token}`;
  const registerQuery = new URLSearchParams({ next: here, ...(invite?.email ? { email: invite.email } : {}) });

  if (preview.isPending || me.isPending)
    return (
      <AuthLayout title="Invitation">
        <div className="flex justify-center py-8">
          <Spinner className="size-6" />
        </div>
      </AuthLayout>
    );

  if (!invite)
    return (
      <AuthLayout title="Invitation">
        <EmptyState
          compact
          icon={<CircleX />}
          title="This invite can't be used"
          description={errorMessage(preview.error)}
          action={
            <Button asChild variant="secondary">
              <Link to="/">Go to MSR Tracker</Link>
            </Button>
          }
        />
      </AuthLayout>
    );

  return (
    <AuthLayout
      title={invite.project ? `Join ${invite.project.name}` : 'Join MSR Tracker'}
      subtitle={`${invite.inviterName} invited you${invite.project ? ' to this project' : ''}.`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-3">
          {invite.project ? (
            <ProjectAvatar color={invite.project.color} icon={invite.project.icon} size="lg" />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-control bg-accent-soft text-accent-text">
              <PartyPopper className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{invite.project?.name ?? 'MSR Tracker'}</p>
            <p className="text-xs text-muted">Invite expires {formatShortDate(invite.expiresAt)}</p>
          </div>
          {invite.roleName && <Badge tone="accent" label={invite.roleName} />}
        </div>
        {me.data ? (
          <div className="flex flex-col gap-2">
            <Button size="lg" block loading={acceptInvite.isPending} onClick={accept}>
              {invite.project ? 'Join project' : 'Continue'}
            </Button>
            <p className="text-center text-xs text-muted">Signed in as {me.data.email}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button asChild size="lg" block>
              <Link to={`/register?${registerQuery}`}>Create an account</Link>
            </Button>
            <Button asChild size="lg" block variant="secondary">
              <Link to={`/login?next=${encodeURIComponent(here)}`}>I already have an account</Link>
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
