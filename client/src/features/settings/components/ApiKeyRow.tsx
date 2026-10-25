import { ExternalLink, KeyRound, Star, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AI_PROVIDER_META, type AiProvider } from '@msr/shared/enums';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/dates';
import { PasswordInput } from '../../auth/components/PasswordInput';
import { useRemoveAiKey, useSaveAiKey, type SavedAiKey } from '../aiKeysApi';

interface ApiKeyRowProps {
  provider: AiProvider;
  saved?: SavedAiKey;
  isDefault: boolean;
  onMakeDefault: () => void;
}

export function ApiKeyRow({ provider, saved, isDefault, onMakeDefault }: ApiKeyRowProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { provider, key },
      {
        onSuccess: () => {
          toast.success(`${meta.label} key verified and saved`);
          setEditing(false);
          setKey('');
        },
      },
    );
  };

  const remove = async () => {
    if (
      await confirm({
        title: `Remove your ${meta.label} key?`,
        description: 'Features that use it will stop working until you add a key again.',
        confirmLabel: 'Remove',
      })
    )
      removeKey.mutate(provider, {
        onSuccess: () => toast.success(`${meta.label} key removed`),
        onError: (error) => toast.error(errorMessage(error)),
      });
  };

  const confirm = useConfirm();
  const save = useSaveAiKey();
  const removeKey = useRemoveAiKey();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const meta = AI_PROVIDER_META[provider];
  const inputId = `ai-key-${provider}`;

  return (
    <div className="flex flex-col gap-3 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control tint text-accent-text [--c:var(--c-accent)] [&>svg]:size-4">
          <KeyRound />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {meta.label}
            <span className="font-normal text-muted">by {meta.vendor}</span>
          </p>
          <p className="text-xs text-muted">
            {saved
              ? `Key ending in ${saved.last4} · checked ${formatDateTime(saved.verifiedAt)}`
              : 'No key added'}
          </p>
        </div>
        {saved && isDefault && <Badge tone="accent" icon={<Star />} label="Default" />}
        {saved && !isDefault && (
          <Button size="xs" variant="ghost" onClick={onMakeDefault}>
            Make default
          </Button>
        )}
        {!editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {saved ? 'Replace' : 'Add key'}
          </Button>
        )}
        {saved && !editing && (
          <Button
            size="sm"
            variant="danger-ghost"
            leftIcon={<Trash2 />}
            loading={removeKey.isPending}
            aria-label={`Remove ${meta.label} key`}
            onClick={remove}
          >
            Remove
          </Button>
        )}
      </div>
      {editing && (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:pl-12" noValidate>
          <label htmlFor={inputId} className="text-xs font-medium">
            {meta.label} API key
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PasswordInput
              id={inputId}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              invalid={!!save.error}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button type="submit" loading={save.isPending} disabled={key.trim().length < 10}>
                Save & test
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setKey('');
                  save.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
          {save.error ? (
            <p role="alert" className="text-xs text-danger">
              {errorMessage(save.error)}
            </p>
          ) : (
            <a
              href={meta.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-start text-xs text-accent-text hover:underline"
            >
              Get a key from {meta.vendor} <ExternalLink className="size-3" />
            </a>
          )}
        </form>
      )}
    </div>
  );
}
