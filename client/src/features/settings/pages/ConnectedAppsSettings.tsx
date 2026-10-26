import { Bot, Copy, Link2, LogIn, MessageSquarePlus, Plug, Settings2, ToggleRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { copyText } from '../../../lib/clipboard';
import { formatRelative, formatShortDate } from '../../../lib/dates';
import { mcpUrl, useConnectedApps, useDisconnectApp } from '../../connector/api';
import { SettingsSection } from '../components/SettingsSection';
import { StepList, type Step } from '../components/StepList';

type Assistant = 'claude' | 'chatgpt';

const ASSISTANTS = [
  { value: 'claude' as const, label: 'Claude' },
  { value: 'chatgpt' as const, label: 'ChatGPT' },
];

const stepsFor = (assistant: Assistant, url: string): Step[] =>
  assistant === 'claude'
    ? [
        {
          icon: <Settings2 />,
          text: 'In Claude, open Settings → Connectors and choose Add custom connector.',
        },
        { icon: <Link2 />, text: <>Name it MSR Tracker and paste {url} as the URL.</> },
        { icon: <LogIn />, text: 'Choose Connect, sign in to MSR if asked, then Allow.' },
        { icon: <MessageSquarePlus />, text: 'In a chat, switch MSR Tracker on from the tools menu.' },
      ]
    : [
        {
          icon: <ToggleRight />,
          text: 'In ChatGPT, open Settings → Apps & Connectors → Advanced settings and turn on Developer mode.',
        },
        {
          icon: <Link2 />,
          text: <>Choose Create, name it MSR Tracker, paste {url} as the MCP server URL and pick OAuth.</>,
        },
        { icon: <LogIn />, text: 'Create it, sign in to MSR if asked, then Allow.' },
        {
          icon: <MessageSquarePlus />,
          text: 'In a chat, pick Developer mode from the + menu and add MSR Tracker.',
        },
      ];

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
  const disconnectApp = useDisconnectApp();
  const [assistant, setAssistant] = useState<Assistant>('claude');
  const url = mcpUrl();

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Connect an AI assistant"
        description="Let Claude or ChatGPT read and update your projects, tasks, shopping lists and calendar for you."
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-control border border-border bg-surface-muted/60 py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 font-mono text-xs break-all">{url}</code>
            <IconButton
              icon={<Copy />}
              label="Copy connector URL"
              onClick={() => copyText(url, 'Connector URL')}
            />
          </div>
          <SegmentedControl
            label="Assistant"
            options={ASSISTANTS}
            value={assistant}
            onChange={setAssistant}
          />
          <StepList steps={stepsFor(assistant, url)} />
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
                  </p>
                  <p className="text-xs text-muted">
                    {app.host} · connected {formatShortDate(app.connectedAt)} · used{' '}
                    {formatRelative(app.lastUsedAt)}
                  </p>
                </div>
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
            description="Follow the steps above to connect Claude or ChatGPT."
          />
        )}
      </SettingsSection>
    </div>
  );
}
