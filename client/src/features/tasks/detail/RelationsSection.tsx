import { Link2, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { RELATION_META, RELATION_TYPES, type RelationType } from '@msr/shared/enums';
import type { TaskDetail } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { errorMessage } from '../../../lib/api';
import { useCreateRelation, useDeleteRelation, useRelations } from '../collabApi';
import { TypeIcon } from '../taskMeta';
import { TextSection } from './TextSection';

interface RelationsSectionProps {
  task: TaskDetail;
  editable: boolean;
  onOpen: (identifier: string) => void;
}

const LABELS: Record<RelationType, { outgoing: string; incoming: string }> = {
  relates: { outgoing: 'Relates to', incoming: 'Relates to' },
  duplicates: { outgoing: 'Duplicates', incoming: 'Duplicated by' },
};

const onError = (error: unknown) => toast.error(errorMessage(error));

export function RelationsSection({ task, editable, onOpen }: RelationsSectionProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target.trim()) return;
    const value = target.trim().toUpperCase();
    setTarget('');
    create.mutate(
      { target: value, type },
      {
        onError: (error) => {
          setTarget(value);
          onError(error);
        },
      },
    );
  };

  const relations = useRelations(task.id);
  const create = useCreateRelation(task.id);
  const remove = useDeleteRelation(task.id);
  const [type, setType] = useState<RelationType>('relates');
  const [target, setTarget] = useState('');
  const items = relations.data ?? [];

  if (!editable && !items.length) return null;

  return (
    <TextSection title="Linked tasks" icon={<Link2 />}>
      <div className="flex flex-col">
        {items.map((relation) => (
          <div
            key={relation.id}
            className="group flex items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-surface-muted"
          >
            <span className="w-24 shrink-0 text-xs text-muted">
              {LABELS[relation.type][relation.direction]}
            </span>
            <button
              type="button"
              onClick={() => onOpen(relation.task.identifier)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            >
              <TypeIcon type={relation.task.type} className="size-3.5" />
              <span className="font-mono text-xs text-subtle">{relation.task.identifier}</span>
              <span
                className={`truncate ${relation.task.statusCategory === 'done' ? 'text-muted line-through' : ''}`}
              >
                {relation.task.title}
              </span>
            </button>
            {editable && (
              <IconButton
                icon={<X />}
                label="Remove link"
                size="xs"
                className="opacity-0 group-hover:opacity-100 max-md:opacity-100"
                onClick={() => remove.mutate(relation.id, { onError })}
              />
            )}
          </div>
        ))}
      </div>
      {editable && (
        <form onSubmit={submit} className="flex gap-2">
          <OptionPicker
            aria-label="Link type"
            value={type}
            onChange={(value) => value && setType(value)}
            options={RELATION_TYPES.map((value) => ({ value, label: RELATION_META[value].label }))}
            className="h-8 w-32 shrink-0"
          />
          <Input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Task ID, e.g. WEB-12"
            size="sm"
            wrapperClassName="flex-1"
            className="font-mono uppercase"
          />
          <Button type="submit" size="sm" variant="secondary" leftIcon={<Plus />} loading={create.isPending}>
            Link
          </Button>
        </form>
      )}
    </TextSection>
  );
}
