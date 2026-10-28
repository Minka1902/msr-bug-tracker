import { Bot, Plug, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Field } from '../../../components/ui/Field';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConfirm } from '../../../hooks/useConfirm';
import { useLocalState } from '../../../hooks/useLocalState';
import { errorMessage } from '../../../lib/api';
import { formatRelative, formatShortDate } from '../../../lib/dates';
import { useWorkers } from '../../agents/api';
import { AiWorkerList } from '../../agents/components/AiWorkerList';
import { ConnectWorkerDialog } from '../../agents/components/ConnectWorkerDialog';
import { AGENT_GUIDES, type AgentId } from '../../connector/agentGuides';
import { mcpUrl, useConnectedApps, useDisconnectApp } from '../../connector/api';
import { SettingsSection } from '../components/SettingsSection';
import { StepList } from '../components/StepList';

const AGENT_OPTIONS = AGENT_GUIDES.map((guide) => ({
  value: guide.id,
  label: guide.label,
  group: guide.group,
}));

export function ConnectedAppsSettings() {
  const disconnect = async (id: string, name: string) => {
    if (
      await confirm({
        title: `Disconnect ${name}?`,
        description: `${name} loses access to your MSR account right away. You can connect it again later.`,
        confirmLabel: 'Disconnect',
      })
    )
      disconnectApp.mutate(id, {
        onSuccess: () => toast.success(`${name} disconnected`),
        onError: (error) => toast.error(errorMessage(error)),
      });
  };

  const confirm = useConfirm();
  const apps = useConnectedApps();
  const workers = useWorkers();
  const [hiring, setHiring] = useState<{ grantId?: string } | null>(null);
  const disconnectApp = useDisconnectApp();
  const [agent, setAgent] = useLocalState<AgentId>('connector-agent', 'claude');
  const url = mcpUrl();
  const guide = AGENT_GUIDES.find((item) => item.id === agent) ?? AGENT_GUIDES[0]!;

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Connect an AI assistant"
        description="Let Claude, ChatGPT or your coding agent read and update your projects, tasks, shopping lists and calendar for you."
      >
        <div className="flex flex-col gap-4">
          <CodeBlock code={url} copyLabel="Connector URL" wrap />
          <Field label="Your AI app">
            <OptionPicker
              aria-label="Your AI app"
              value={guide.id}
              onChange={(value) => value && setAgent(value)}
              options={AGENT_OPTIONS}
              className="w-full sm:w-64"
            />
          </Field>
          <StepList steps={guide.steps(url)} />
        </div>
      </SettingsSection>
      <SettingsSection
        title="Connected apps"
        description="Apps you allowed to use your account. Changing your password disconnects all of them."
      >
        {apps.isPending ? (
          <Skeleton className="h-16" />
        ) : apps.data?.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {apps.data.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text [&_svg]:size-4.5">
                  <Bot />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{app.name}</span>
                    <Badge
                      tone={app.scopes.includes('write') ? 'accent' : 'neutral'}
                      label={app.scopes.includes('write') ? 'Read and write' : 'Read only'}
                    />
                    {app.worker && <Badge tone="violet" icon={<Bot />} label={app.worker.name} />}
                  </p>
                  <p className="text-xs text-muted">
                    {app.host} · connected {formatShortDate(app.connectedAt)} · used{' '}
                    {formatRelative(app.lastUsedAt)}
                  </p>
                </div>
                {!app.worker && (
                  <Button variant="soft" size="sm" onClick={() => setHiring({ grantId: app.id })}>
                    Make it an AI worker
                  </Button>
                )}
                <Button
                  variant="danger-ghost"
                  size="sm"
                  loading={disconnectApp.isPending && disconnectApp.variables === app.id}
                  onClick={() => disconnect(app.id, app.name)}
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<Plug />}
            title="No apps connected"
            description="Follow the steps above to connect your AI app."
          />
        )}
      </SettingsSection>
      <SettingsSection
        title="AI workers"
        description="A connected app can work in your projects as its own member, with a role, and take tasks you assign it."
        footer={
          <Button
            variant="secondary"
            leftIcon={<Plus />}
            disabled={!apps.data?.some((app) => !app.worker)}
            onClick={() => setHiring({})}
          >
            New AI worker
          </Button>
        }
      >
        {workers.isPending ? (
          <Skeleton className="h-16" />
        ) : (
          <AiWorkerList workers={workers.data ?? []} apps={apps.data ?? []} />
        )}
      </SettingsSection>
      {hiring && (
        <ConnectWorkerDialog
          open
          onOpenChange={(open) => !open && setHiring(null)}
          apps={apps.data ?? []}
          initialGrantId={hiring.grantId}
        />
      )}
    </div>
  );
}
