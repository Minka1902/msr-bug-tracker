import { useState, type ReactNode } from 'react';
import { CalendarDays, CircleDot, FolderInput, Flag, Shapes, Tag, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_CATEGORIES, STATUS_CATEGORY_META, workflowOf } from '@msr/shared/enums';
import type { BulkPatch } from '@msr/shared/schemas/task';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../../components/ui/DatePicker';
import { IconButton } from '../../../components/ui/IconButton';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { useConfirm } from '../../../hooks/useConfirm';
import { ApiError, errorMessage } from '../../../lib/api';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useBulkDelete, useBulkMove, useBulkUpdate } from '../api';
import { MoveTaskModal } from '../detail/MoveTaskModal';
import { typeChange } from '../taskMeta';
import { UNASSIGNED, useTaskOptions } from '../useTaskOptions';

interface BulkActionBarProps {
  project: ProjectDetail;
  selected: TaskCard[];
  onClear: () => void;
}

const reportError = (error: unknown) => {
  const tasks =
    error instanceof ApiError ? (error.details as { tasks?: string[] } | undefined)?.tasks : undefined;
  toast.error(tasks?.length ? `${errorMessage(error)}: ${tasks.join(', ')}` : errorMessage(error));
};

const pill = (icon: ReactNode, label: string) => (
  <Button
    size="sm"
    variant="ghost"
    leftIcon={icon}
    className="text-inverted hover:bg-white/10 hover:text-inverted"
  >
    {label}
  </Button>
);

export function BulkActionBar({ project, selected, onClear }: BulkActionBarProps) {
  const apply = (patch: BulkPatch, label: string) =>
    bulk.mutate(
      { ids: selected.map((task) => task.id), patch },
      {
        onSuccess: () => toast.success(`${label} updated for ${selected.length} tasks`),
        onError: reportError,
      },
    );

  const remove = async () => {
    const confirmed = await confirm({
      title: `Delete ${selected.length} tasks?`,
      description: 'Their subtasks, comments and files are deleted too. This cannot be undone.',
      confirmLabel: 'Delete tasks',
    });
    if (confirmed)
      bulkDelete.mutate(
        selected.map((task) => task.id),
        { onSuccess: onClear, onError: reportError },
      );
  };

  const move = (projectKey: string) =>
    bulkMove.mutate(
      { ids: selected.map((task) => task.id), projectKey },
      {
        onSuccess: () => {
          toast.success(`Moved ${selected.length} tasks to ${projectKey}`);
          setMoving(false);
          onClear();
        },
        onError: reportError,
      },
    );

  const options = useTaskOptions(project);
  const permissions = useProjectPermissions(project);
  const confirm = useConfirm();
  const bulk = useBulkUpdate(project.key);
  const bulkDelete = useBulkDelete(project.key);
  const bulkMove = useBulkMove(project.key);
  const [moving, setMoving] = useState(false);
  const typeOptions = options.type.filter((option) => !option.disabled);
  const workflows = new Set(selected.map((task) => workflowOf(task.type)));
  const singleWorkflow = workflows.size === 1 ? [...workflows][0]! : null;

  if (!selected.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:bottom-6">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-surface-inverted px-2 py-1.5 text-inverted shadow-pop no-scrollbar">
        <span className="px-3 text-sm font-semibold whitespace-nowrap">{selected.length} selected</span>
        {singleWorkflow ? (
          <OptionPicker
            value={null}
            options={options.status(singleWorkflow)}
            onChange={(statusId) => statusId && apply({ statusId }, 'Status')}
            renderTrigger={() => pill(<CircleDot />, 'Status')}
          />
        ) : (
          <OptionPicker
            value={null}
            options={STATUS_CATEGORIES.map((value) => ({
              value,
              label: STATUS_CATEGORY_META[value].label,
              description: 'First matching status of each workflow',
            }))}
            onChange={(category) => category && apply({ statusCategory: category }, 'Status')}
            renderTrigger={() => pill(<CircleDot />, 'Status')}
          />
        )}
        <OptionPicker
          value={null}
          options={options.priority}
          onChange={(priority) => priority && apply({ priority }, 'Priority')}
          renderTrigger={() => pill(<Flag />, 'Priority')}
        />
        <OptionPicker
          searchable
          value={null}
          options={[{ value: UNASSIGNED, label: 'Unassigned' }, ...options.assignee]}
          onChange={(id) => id && apply({ assigneeId: id === UNASSIGNED ? null : id }, 'Assignee')}
          renderTrigger={() => pill(<UserRound />, 'Assign')}
        />
        <DatePicker
          value={null}
          clearable
          clearLabel="No due date"
          onChange={(dueDate) => apply({ dueDate }, 'Due date')}
          renderTrigger={() => pill(<CalendarDays />, 'Due date')}
        />
        {typeOptions.length > 1 && (
          <OptionPicker
            value={null}
            options={typeOptions}
            onChange={(value) => value && apply(typeChange(value, project.cardTypes).input, 'Type')}
            renderTrigger={() => pill(<Shapes />, 'Type')}
          />
        )}
        <OptionPicker
          multiple
          searchable
          value={[]}
          options={options.label}
          onChange={(ids) => ids.length && apply({ addLabelIds: ids }, 'Labels')}
          renderTrigger={() => pill(<Tag />, 'Add label')}
        />
        <OptionPicker
          multiple
          searchable
          value={[]}
          options={options.label}
          onChange={(ids) => ids.length && apply({ removeLabelIds: ids }, 'Labels')}
          renderTrigger={() => pill(<Tag />, 'Remove label')}
        />
        {permissions.can('task.move') && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FolderInput />}
            onClick={() => setMoving(true)}
            className="text-inverted hover:bg-white/10 hover:text-inverted"
          >
            Move
          </Button>
        )}
        {permissions.can('task.delete') && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Trash2 />}
            onClick={remove}
            className="text-danger hover:bg-white/10"
          >
            Delete
          </Button>
        )}
        <IconButton
          icon={<X />}
          label="Clear selection"
          onClick={onClear}
          className="text-inverted hover:bg-white/10 hover:text-inverted"
        />
      </div>
      <MoveTaskModal
        open={moving}
        title={`Move ${selected.length} tasks`}
        sourceKey={project.key}
        confirmLabel="Move tasks"
        loading={bulkMove.isPending}
        onCancel={() => setMoving(false)}
        onConfirm={move}
      />
    </div>
  );
}
