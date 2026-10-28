import { MessageCircle, Unlink, Users } from 'lucide-react';
import type { UpdateTelegramChatInput } from '@msr/shared/schemas/telegram';
import { NOTIFY_META, type NotifyKind } from '@msr/shared/telegram';
import type { TelegramChat } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Switch } from '../../../components/ui/Switch';
import { cn } from '../../../lib/cn';

interface ChatNotificationSettingsProps {
  chat: TelegramChat;
  kinds: readonly NotifyKind[];
  meta?: Record<NotifyKind, { label: string; description: string }>;
  lists?: { id: string; name: string }[];
  disabled?: boolean;
  disabledReason?: string;
  unlinking?: boolean;
  onChange: (patch: UpdateTelegramChatInput) => void;
  onUnlink: () => void;
  className?: string;
}

export function ChatNotificationSettings({
  chat,
  kinds,
  meta = NOTIFY_META,
  lists,
  disabled,
  disabledReason,
  unlinking,
  onChange,
  onUnlink,
  className,
}: ChatNotificationSettingsProps) {
  const toggle = (kind: NotifyKind, on: boolean) =>
    onChange({ notify: on ? [...chat.notify, kind] : chat.notify.filter((item) => item !== kind) });

  return (
    <div className={cn('flex flex-col gap-4 rounded-control border border-border p-4', className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-muted [&>svg]:size-4.5">
          {chat.isGroup ? <Users /> : <MessageCircle />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {chat.title || (chat.isGroup ? 'Telegram group' : 'Private chat')}
          </p>
          <p className="text-xs text-muted">
            {chat.isGroup ? 'Group chat' : chat.mine ? 'Your private chat' : 'Private chat'}
          </p>
        </div>
        {!disabled && (
          <Button size="sm" variant="ghost" leftIcon={<Unlink />} loading={unlinking} onClick={onUnlink}>
            Unlink
          </Button>
        )}
      </div>
      {disabled && disabledReason && <p className="text-xs text-muted">{disabledReason}</p>}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {kinds.map((kind) => (
          <Switch
            key={kind}
            size="sm"
            checked={chat.notify.includes(kind)}
            disabled={disabled}
            label={meta[kind].label}
            description={meta[kind].description}
            onCheckedChange={(on) => toggle(kind, on)}
          />
        ))}
      </div>
      {!chat.isGroup && (
        <Switch
          size="sm"
          checked={chat.onlyMine}
          disabled={disabled}
          label="Only my tasks"
          description="Task updates only for tasks assigned to you or added by you"
          onCheckedChange={(onlyMine) => onChange({ onlyMine })}
        />
      )}
      {lists && (
        <Field label="Plain messages go to" hint="Typing just “apples” adds it to this list">
          <OptionPicker
            aria-label="Default shopping list"
            value={chat.defaultListId}
            onChange={(defaultListId) => onChange({ defaultListId })}
            options={lists.map((list) => ({ value: list.id, label: list.name }))}
            placeholder={lists[0] ? `${lists[0].name} (first list)` : 'No lists yet'}
            clearable
            disabled={disabled || !lists.length}
            className="w-full sm:w-72"
          />
        </Field>
      )}
    </div>
  );
}
