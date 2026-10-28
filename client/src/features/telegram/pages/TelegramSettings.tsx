import { Bot, Lock, MessageCircle, Unplug, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BOT_META, PLAN_META } from '@msr/shared/modules';
import type { UpdateTelegramChatInput } from '@msr/shared/schemas/telegram';
import { kindsFor } from '@msr/shared/telegram';
import type { TelegramChat } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { useAppConfig } from '../../demo/api';
import { useShoppingLists } from '../../household/shoppingApi';
import { useProjectContext } from '../../projects/useProjectContext';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { SettingsSection } from '../../settings/components/SettingsSection';
import {
  useDisconnectTelegram,
  useTelegramLink,
  useTelegramSettings,
  useUnlinkTelegramChat,
  useUpdateTelegramChat,
} from '../api';
import { ChatNotificationSettings } from '../components/ChatNotificationSettings';
import { TelegramLinkDialog } from '../components/TelegramLinkDialog';

const onError = (error: unknown) => toast.error(errorMessage(error));

const commandsFor = (household: boolean, key: string) => [
  ...(household
    ? [
        { text: 'apples, milk', description: 'Add to the shopping list' },
        { text: 'add nails to hardware list', description: 'Add to a named list' },
        { text: 'i bought apples', description: 'Tick them off' },
        { text: '?  ·  groceries?', description: 'What is on the lists' },
        { text: 'appointments?', description: 'The next two weeks' },
      ]
    : []),
  {
    text: household ? 'chores?  ·  mine?' : 'tasks?  ·  mine?',
    description: 'Open work by person, or yours',
  },
  { text: 'dana needs to wash the car tomorrow', description: 'Add a task for someone' },
  { text: `${key}-12?  ·  done ${key}-12`, description: 'Look up or finish a task' },
  { text: 'use KEY', description: 'Switch the chat to another connected project' },
];

export function TelegramSettings() {
  const connect = (target: 'private' | 'group') =>
    link.mutate(target, { onSuccess: (answer) => setUrl(answer.url), onError });

  const update = (chatId: number, patch: UpdateTelegramChatInput) =>
    updateChat.mutate({ chatId, patch }, { onError });

  const unlink = async (chat: TelegramChat) => {
    if (
      await confirm({
        title: `Unlink ${chat.title || 'this chat'}?`,
        description: 'The bot stops answering there and sends no more updates for this project.',
        confirmLabel: 'Unlink',
      })
    )
      unlinkChat.mutate(chat.chatId, { onError });
  };

  const disconnect = async () => {
    if (
      await confirm({
        title: 'Disconnect your Telegram account?',
        description: 'The bot stops acting as you, and your private chats are unlinked from every project.',
        confirmLabel: 'Disconnect',
      })
    )
      disconnectMe.mutate(undefined, { onError });
  };

  const project = useProjectContext();
  const { can } = useProjectPermissions(project);
  const confirm = useConfirm();
  const config = useAppConfig();
  const household = project.module === 'household';
  const enabled = !!config.data?.features.telegram;
  const settings = useTelegramSettings(project.key, enabled);
  const lists = useShoppingLists(project.key, false, enabled && household);
  const link = useTelegramLink(project.key);
  const updateChat = useUpdateTelegramChat(project.key);
  const unlinkChat = useUnlinkTelegramChat(project.key);
  const disconnectMe = useDisconnectTelegram();
  const [url, setUrl] = useState<string | null>(null);

  if (config.data && !enabled)
    return (
      <SettingsSection title={BOT_META.label}>
        <EmptyState compact icon={<Bot />} title="Telegram isn't set up on this server yet" />
      </SettingsSection>
    );
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} />;
  if (!settings.data) return <Skeleton className="h-64 rounded-card" />;

  if (!settings.data.allowed) {
    const plan = PLAN_META[settings.data.requiredPlan].label;
    return (
      <SettingsSection title={BOT_META.label} description={BOT_META.description}>
        <EmptyState
          icon={<Lock />}
          title={`Needs the ${plan} plan`}
          description={
            project.isOwner
              ? `The ${plan} plan adds the Telegram bot to ${household ? 'households' : 'every project'}.`
              : `Ask the project owner to get the ${plan} plan.`
          }
          action={
            project.isOwner && (
              <Button size="sm" asChild>
                <Link to="/shop">See plans</Link>
              </Button>
            )
          }
        />
      </SettingsSection>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title={BOT_META.label}
        description="Chat with the bot privately or add it to a family or team group. It acts with your own permissions in this project."
        footer={
          settings.data.connected && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Unplug />}
              loading={disconnectMe.isPending}
              onClick={disconnect}
            >
              Disconnect my Telegram
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              leftIcon={<MessageCircle />}
              loading={link.isPending && link.variables === 'private'}
              onClick={() => connect('private')}
            >
              Connect me
            </Button>
            {can('project.edit') && (
              <Button
                variant="secondary"
                leftIcon={<Users />}
                loading={link.isPending && link.variables === 'group'}
                onClick={() => connect('group')}
              >
                Add to a group
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            {settings.data.connected
              ? 'Your Telegram account is connected.'
              : 'Connecting links your Telegram account to you, so the bot knows who is writing.'}{' '}
            In a group, if plain messages like “apples” get no answer, make the bot an admin of the group.
          </p>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Chats"
        description="Pick what each chat is told. Groups can be changed by anyone who can edit the project, private chats only by their owner."
      >
        {settings.data.chats.length ? (
          <div className="flex flex-col gap-3">
            {settings.data.chats.map((chat) => (
              <ChatNotificationSettings
                key={chat.chatId}
                chat={chat}
                kinds={kindsFor(household)}
                lists={household ? (lists.data ?? []) : undefined}
                disabled={!chat.canEdit}
                disabledReason="Only people who can edit the project change a group's updates."
                unlinking={unlinkChat.isPending && unlinkChat.variables === chat.chatId}
                onChange={(patch) => update(chat.chatId, patch)}
                onUnlink={() => unlink(chat)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={<MessageCircle />}
            title="No chats yet"
            description="Connect yourself or add the bot to a group."
          />
        )}
      </SettingsSection>
      <SettingsSection title="What you can send" description="Upper or lower case, with or without a slash.">
        <dl className="flex flex-col gap-2 text-sm">
          {commandsFor(household, project.key).map((command) => (
            <div key={command.text} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="sm:w-72 sm:shrink-0">
                <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs [overflow-wrap:anywhere]">
                  {command.text}
                </code>
              </dt>
              <dd className="text-muted">{command.description}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>
      <TelegramLinkDialog url={url} onOpenChange={(open) => !open && setUrl(null)} />
    </div>
  );
}
