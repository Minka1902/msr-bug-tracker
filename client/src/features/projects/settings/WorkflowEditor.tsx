import { generateKeyBetween } from 'fractional-indexing';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  STATUS_CATEGORIES,
  STATUS_CATEGORY_META,
  WORKFLOW_META,
  type StatusCategory,
  type Workflow,
} from '@msr/shared/enums';
import type { ProjectStatus } from '@msr/shared/types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ColorSwatchPicker } from '../../../components/ui/ColorSwatchPicker';
import { IconButton } from '../../../components/ui/IconButton';
import { InlineText } from '../../../components/ui/InlineText';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { SortableList } from '../../../components/ui/SortableList';
import { errorMessage } from '../../../lib/api';
import { useCreateStatus, useDeleteStatus, useUpdateStatus } from '../api';
import { DeleteStatusModal } from './DeleteStatusModal';

interface WorkflowEditorProps {
  projectKey: string;
  workflow: Workflow;
  statuses: ProjectStatus[];
  editable: boolean;
}

const CATEGORY_OPTIONS = STATUS_CATEGORIES.map((category) => ({
  value: category,
  label: STATUS_CATEGORY_META[category].label,
  color: `var(--tone-${STATUS_CATEGORY_META[category].tone})`,
}));

const onError = (error: unknown) => toast.error(errorMessage(error));

export function WorkflowEditor({ projectKey, workflow, statuses, editable }: WorkflowEditorProps) {
  const move = (status: ProjectStatus, previous: ProjectStatus | null, next: ProjectStatus | null) =>
    update.mutate(
      { id: status.id, position: generateKeyBetween(previous?.position ?? null, next?.position ?? null) },
      { onError },
    );

  const add = () =>
    create.mutate(
      { workflow, name: `New status ${statuses.length + 1}`, color: '#64748b', category: 'in_progress' },
      { onError },
    );

  const create = useCreateStatus(projectKey);
  const update = useUpdateStatus(projectKey);
  const remove = useDeleteStatus(projectKey);
  const [deleting, setDeleting] = useState<ProjectStatus | null>(null);

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Badge tone={WORKFLOW_META[workflow].tone} label={WORKFLOW_META[workflow].label} />
        <span className="flex-1 text-sm text-muted">{statuses.length} statuses</span>
        {editable && (
          <Button size="sm" variant="ghost" leftIcon={<Plus />} onClick={add} loading={create.isPending}>
            Add status
          </Button>
        )}
      </div>
      <SortableList
        items={statuses}
        getId={(status) => status.id}
        onMove={move}
        disabled={!editable}
        className="flex flex-col p-2"
        renderItem={(status, handle, dragging) => (
          <div
            className={`flex items-center gap-2 rounded-control px-1 py-1 ${dragging ? 'bg-surface shadow-pop' : 'hover:bg-surface-muted/60'}`}
          >
            {editable && (
              <button
                type="button"
                aria-label={`Reorder ${status.name}`}
                className="cursor-grab touch-none text-subtle active:cursor-grabbing"
                {...handle}
              >
                <GripVertical className="size-4" />
              </button>
            )}
            <ColorSwatchPicker
              value={status.color}
              disabled={!editable}
              onChange={(color) => update.mutate({ id: status.id, color }, { onError })}
            />
            <InlineText
              aria-label="Status name"
              value={status.name}
              maxLength={40}
              disabled={!editable}
              onSave={(name) => update.mutate({ id: status.id, name }, { onError })}
            />
            <OptionPicker
              aria-label="Category"
              value={status.category}
              disabled={!editable}
              onChange={(category) =>
                category &&
                update.mutate({ id: status.id, category: category as StatusCategory }, { onError })
              }
              options={CATEGORY_OPTIONS}
              className="h-8 w-36 shrink-0"
            />
            {editable && (
              <IconButton
                icon={<Trash2 />}
                label={`Delete ${status.name}`}
                variant="danger-ghost"
                onClick={() => setDeleting(status)}
              />
            )}
          </div>
        )}
      />
      <DeleteStatusModal
        key={deleting?.id}
        status={deleting}
        candidates={statuses}
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={(moveTo) =>
          remove.mutate({ id: deleting!.id, moveTo }, { onSuccess: () => setDeleting(null), onError })
        }
      />
    </Card>
  );
}
