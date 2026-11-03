import { MessageCircle, Unplug, Users } from 'lucide-react';
import { BOT_PLATFORM_META } from '@msr/shared/bots';
import type { BotPlatformState } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { SettingsSection } from '../../settings/components/SettingsSection';

interface BotConnectSectionProps {
  state: BotPlatformState;
  canAddGroup: boolean;
  connecting: 'private' | 'group' | null;
  disconnecting: boolean;
  onConnect: (target: 'private' | 'group') => void;
  onDisconnect: () => void;
}

const HINTS = {
  telegram: 'In a group, if plain messages like “apples” get no answer, make the bot an admin of the group.',
  discord:
    'In a connected channel the bot reads every message. In other channels it answers only when you mention it.',
};

export function BotConnectSection({
  state,
  canAddGroup,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
}: BotConnectSectionProps) {
  const { label, groupLabel } = BOT_PLATFORM_META[state.platform];

  return (
    <SettingsSection
      title={label}
      description={`Chat with ${state.botName ? `@${state.botName}` : 'the bot'} privately or add it to a family or team ${groupLabel}. It acts with your own permissions in this project.`}
      footer={
        state.connected && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Unplug />}
            loading={disconnecting}
            onClick={onDisconnect}
          >
            Disconnect my {label}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            leftIcon={<MessageCircle />}
            loading={connecting === 'private'}
            onClick={() => onConnect('private')}
            aria-label={`Connect me on ${label}`}
          >
            Connect me
          </Button>
          {canAddGroup && (
            <Button
              variant="secondary"
              leftIcon={<Users />}
              loading={connecting === 'group'}
              onClick={() => onConnect('group')}
              aria-label={`Add to a ${label} ${groupLabel}`}
            >
              Add to a {groupLabel}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">
          {state.connected
            ? `Your ${label} account is connected.`
            : `Connecting links your ${label} account to you, so the bot knows who is writing.`}{' '}
          {HINTS[state.platform]}
        </p>
      </div>
    </SettingsSection>
  );
}
