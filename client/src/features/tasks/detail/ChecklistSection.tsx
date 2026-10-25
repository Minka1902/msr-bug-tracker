import { generateKeyBetween } from 'fractional-indexing';
import { GripVertical, ListChecks, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { TaskDetail } from '@msr/shared/types';
import { Checkbox } from '../../../components/ui/Checkbox';
import { IconButton } from '../../../components/ui/IconButton';
import { InlineText } from '../../../components/ui/InlineText';
import { Input } from '../../../components/ui/Input';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { SortableList } from '../../../components/ui/SortableList';
import { errorMessage } from '../../../lib/api';
import {
  useChecklist,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from '../collabApi';
import { TextSection } from './TextSection';

interface ChecklistSectionProps {
  task: TaskDetail;
  editable: boolean;
}

const onError = (error: unknown) => toast.error(errorMessage(error));

export function ChecklistSection({ task, editable }: ChecklistSectionProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const value = text.trim();
    setText('');
    create.mutate(value, {
      onError: (error) => {
        setText(value);
        onError(error);
      },
    });
  };

  const checklist = useChecklist(task.id);
  const create = useCreateChecklistItem(task.id);
  const update = useUpdateChecklistItem(task.id);
  const remove = useDeleteChecklistItem(task.id);
  const [text, setText] = useState('');
  const items = checklist.data ?? [];

  if (!editable && !items.length) return null;

  return (
    <TextSection
      title="Checklist"
      icon={<ListChecks />}
      action={
        items.length > 0 && (
          <span className="text-xs text-muted tabular-nums">{`${task.checklistDone}/${task.checklistTotal}`}</span>
        )
      }
    >
      {items.length > 0 && (
        <ProgressBar
          value={(items.filter((item) => item.isDone).length / items.length) * 100}
          size="xs"
          color="var(--tone-success)"
        />
      )}
      <SortableList
        items={items}
        getId={(item) => item.id}
        disabled={!editable}
        onMove={(item, previous, next) =>
          update.mutate(
            { id: item.id, position: generateKeyBetween(previous?.position ?? null, next?.position ?? null) },
            { onError },
          )
        }
        renderItem={(item, handle) => (
          <div className="group flex items-center gap-1.5 rounded-control px-1 hover:bg-surface-muted/60">
            {editable && (
              <button
                type="button"
                aria-label="Reorder"
                className="cursor-grab touch-none text-subtle opacity-0 group-hover:opacity-100 max-md:opacity-100"
                {...handle}
              >
                <GripVertical className="size-3.5" />
              </button>
            )}
            <Checkbox
              checked={item.isDone}
              disabled={!editable}
              aria-label={item.text}
              onCheckedChange={(isDone) => update.mutate({ id: item.id, isDone }, { onError })}
            />
            <InlineText
              aria-label="Checklist item"
              value={item.text}
              disabled={!editable}
              maxLength={500}
              className={item.isDone ? 'text-muted line-through' : undefined}
              onSave={(next) => update.mutate({ id: item.id, text: next }, { onError })}
            />
            {editable && (
              <IconButton
                icon={<X />}
                label="Remove item"
                size="xs"
                className="opacity-0 group-hover:opacity-100 max-md:opacity-100"
                onClick={() => remove.mutate(item.id, { onError })}
              />
            )}
          </div>
        )}
      />
      {editable && (
        <form onSubmit={submit}>
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add an item and press Enter"
            size="sm"
            leftIcon={<Plus />}
            maxLength={500}
          />
        </form>
      )}
    </TextSection>
  );
}
