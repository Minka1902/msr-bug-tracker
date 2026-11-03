import { Lock, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BOT_PLATFORM_META, kindsFor, type BotPlatform } from '@msr/shared/bots';
import { BOT_META, PLAN_META } from '@msr/shared/modules';
import type { UpdateBotChatInput } from '@msr/shared/schemas/bots';
import type { BotChat, BotLink } from '@msr/shared/types';
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
import { useBotLink, useBotSettings, useDisconnectBot, useUnlinkBotChat, useUpdateBotChat } from '../api';
import { BotConnectSection } from '../components/BotConnectSection';
import { BotLinkDialog } from '../components/BotLinkDialog';
import { ChatNotificationSettings } from '../components/ChatNotificationSettings';

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

export function BotSettings() {
  const connect = (platform: BotPlatform, target: 'private' | 'group') =>
    link.mutate(
      { platform, target },
      { onSuccess: (answer) => setOpened({ ...answer, isGroup: target === 'group' }), onError },
    );

  const update = (chat: BotChat, patch: UpdateBotChatInput) =>
    updateChat.mutate({ platform: chat.platform, chatId: chat.chatId, patch }, { onError });

  const unlink = async (chat: BotChat) => {
    if (
      await confirm({
        title: `Unlink ${chat.title || 'this chat'}?`,
        description: 'The bot stops answering there and sends no more updates for this project.',
        confirmLabel: 'Unlink',
      })
    )
      unlinkChat.mutate({ platform: chat.platform, chatId: chat.chatId }, { onError });
  };

  const disconnect = async (platform: BotPlatform) => {
    const { label } = BOT_PLATFORM_META[platform];
    if (
      await confirm({
        title: `Disconnect your ${label} account?`,
        description: 'The bot stops acting as you, and your private chats are unlinked from every project.',
        confirmLabel: 'Disconnect',
      })
    )
      disconnectMe.mutate(platform, { onError });
  };

  const project = useProjectContext();
  const { can } = useProjectPermissions(project);
  const confirm = useConfirm();
  const config = useAppConfig();
  const household = project.module === 'household';
  const enabled = !!(config.data?.features.telegram || config.data?.features.discord);
  const settings = useBotSettings(project.key, enabled);
  const lists = useShoppingLists(project.key, false, enabled && household);
  const link = useBotLink(project.key);
  const updateChat = useUpdateBotChat(project.key);
  const unlinkChat = useUnlinkBotChat(project.key);
  const disconnectMe = useDisconnectBot();
  const [opened, setOpened] = useState<(BotLink & { isGroup: boolean }) | null>(null);

  if (config.data && !enabled)
    return <EmptyState icon={<MessageCircle />} title="No chat bot is set up on this server" />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} />;
  if (!settings.data) return <Skeleton className="h-64 rounded-card" />;

  if (!settings.data.allowed) {
    const plan = PLAN_META[settings.data.requiredPlan].label;
    return (
      <SettingsSection title={BOT_META.label} description={BOT_META.description}>
        <EmptyState
          icon={<Lock />}
          title={`Needs the ${plan} plan`}
          description={`The ${plan} plan adds the chat bots to ${household ? 'households' : 'every project'}.`}
          action={
            <Button size="sm" asChild>
              <Link to="/shop">See plans</Link>
            </Button>
          }
        />
      </SettingsSection>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {settings.data.platforms.map((state) => (
        <BotConnectSection
          key={state.platform}
          state={state}
          canAddGroup={can('project.edit')}
          connecting={
            link.isPending && link.variables.platform === state.platform ? link.variables.target : null
          }
          disconnecting={disconnectMe.isPending && disconnectMe.variables === state.platform}
          onConnect={(target) => connect(state.platform, target)}
          onDisconnect={() => disconnect(state.platform)}
        />
      ))}
      <SettingsSection
        title="Chats"
        description="Pick what each chat is told. Groups and channels can be changed by anyone who can edit the project, private chats only by their owner."
      >
        {settings.data.chats.length ? (
          <div className="flex flex-col gap-3">
            {settings.data.chats.map((chat) => (
              <ChatNotificationSettings
                key={`${chat.platform}:${chat.chatId}`}
                chat={chat}
                kinds={kindsFor(household)}
                lists={household ? (lists.data ?? []) : undefined}
                unlinking={
                  unlinkChat.isPending &&
                  unlinkChat.variables.platform === chat.platform &&
                  unlinkChat.variables.chatId === chat.chatId
                }
                onChange={(patch) => update(chat, patch)}
                onUnlink={() => unlink(chat)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={<MessageCircle />}
            title="No chats yet"
            description="Connect yourself or add the bot to a group or channel."
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
      <BotLinkDialog
        link={opened}
        botName={
          settings.data.platforms.find((state) => state.platform === opened?.platform)?.botName ?? null
        }
        onOpenChange={(open) => !open && setOpened(null)}
      />
    </div>
  );
}
