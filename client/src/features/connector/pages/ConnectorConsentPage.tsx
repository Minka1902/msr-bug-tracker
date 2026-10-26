import { CircleX, Eye, PencilLine, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { ConnectorScope } from '@msr/shared/enums';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { errorMessage } from '../../../lib/api';
import { useMe } from '../../auth/api';
import { AuthLayout } from '../../auth/components/AuthLayout';
import { useConnectorRequest, useDecideConnector } from '../api';

type Access = 'read' | 'write';

const ACCESS_SCOPES: Record<Access, ConnectorScope[]> = { read: ['read'], write: ['read', 'write'] };

export function ConnectorConsentPage() {
  const decide = (approve: boolean) =>
    decision.mutate(
      { request, approve, scopes: ACCESS_SCOPES[access] },
      { onSuccess: (redirectUrl) => window.location.assign(redirectUrl) },
    );

  const [params] = useSearchParams();
  const request = params.get('request') ?? '';
  const me = useMe();
  const preview = useConnectorRequest(request, !!me.data);
  const decision = useDecideConnector();
  const [chosen, setChosen] = useState<Access>('write');
  const canWrite = preview.data?.scopes.includes('write') ?? false;
  const access = canWrite ? chosen : 'read';
  const here = `/connect/authorize?${params}`;

  if (me.isPending || (me.data && preview.isPending && request))
    return (
      <AuthLayout title="Connect an app">
        <div className="flex justify-center py-8">
          <Spinner className="size-6" />
        </div>
      </AuthLayout>
    );

  if (!me.data)
    return (
      <AuthLayout title="Connect an app" subtitle="Sign in to MSR Tracker to continue.">
        <Button asChild size="lg" block>
          <Link to={`/login?next=${encodeURIComponent(here)}`}>Sign in</Link>
        </Button>
      </AuthLayout>
    );

  if (!preview.data)
    return (
      <AuthLayout title="Connect an app">
        <EmptyState
          compact
          icon={<CircleX />}
          title="This request can't be used"
          description={request ? errorMessage(preview.error) : 'The link is missing its request.'}
          action={
            <Button asChild variant="secondary">
              <Link to="/">Go to MSR Tracker</Link>
            </Button>
          }
        />
      </AuthLayout>
    );

  const { clientName, redirectHost } = preview.data;

  return (
    <AuthLayout
      title={`Connect ${clientName}`}
      subtitle={
        <>
          <strong className="text-text">{clientName}</strong> wants to use your MSR Tracker account. You'll be
          sent back to <strong className="text-text">{redirectHost}</strong>.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ChoiceGroup
          label="Access"
          columns={2}
          value={access}
          onChange={setChosen}
          choices={[
            {
              value: 'read',
              label: 'Read only',
              description: 'See your projects, tasks, lists and calendar',
              icon: <Eye />,
            },
            ...(canWrite
              ? [
                  {
                    value: 'write' as const,
                    label: 'Read and write',
                    description: 'Also create and update tasks, comments, lists and events',
                    icon: <PencilLine />,
                  },
                ]
              : []),
          ]}
        />
        <Banner tone="info" icon={<ShieldCheck />}>
          It acts as you, with your role in each project, and can't delete anything. Disconnect it any time in
          Settings → Connected apps.
        </Banner>
        {decision.error && <Banner tone="danger">{errorMessage(decision.error)}</Banner>}
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            block
            loading={decision.isPending && decision.variables?.approve}
            onClick={() => decide(true)}
          >
            Allow
          </Button>
          <Button
            size="lg"
            block
            variant="secondary"
            disabled={decision.isPending}
            onClick={() => decide(false)}
          >
            Cancel
          </Button>
          <p className="text-center text-xs text-muted">Signed in as {me.data.email}</p>
        </div>
      </div>
    </AuthLayout>
  );
}
