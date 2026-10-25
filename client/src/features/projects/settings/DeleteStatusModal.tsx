import { useState } from 'react';
import type { ProjectStatus } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';

interface DeleteStatusModalProps {
  status: ProjectStatus | null;
  candidates: ProjectStatus[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (moveTo: string) => void;
}

export function DeleteStatusModal({
  status,
  candidates,
  loading,
  onCancel,
  onConfirm,
}: DeleteStatusModalProps) {
  const [target, setTarget] = useState<string | null>(null);
  const options = candidates.filter((candidate) => candidate.id !== status?.id);
  const moveTo =
    target ?? options.find((option) => option.category === status?.category)?.id ?? options[0]?.id ?? null;

  return (
    <Modal
      open={!!status}
      onOpenChange={(open) => !open && onCancel()}
      size="sm"
      title={`Delete “${status?.name}”?`}
      description="Tasks in this status will move to the status you pick."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!moveTo}
            loading={loading}
            onClick={() => moveTo && onConfirm(moveTo)}
          >
            Delete status
          </Button>
        </>
      }
    >
      <Field label="Move tasks to">
        <OptionPicker
          aria-label="Move tasks to"
          value={moveTo}
          onChange={setTarget}
          options={options.map((option) => ({ value: option.id, label: option.name, color: option.color }))}
          className="w-full"
          contentClassName="w-(--radix-popover-trigger-width)"
        />
      </Field>
    </Modal>
  );
}
