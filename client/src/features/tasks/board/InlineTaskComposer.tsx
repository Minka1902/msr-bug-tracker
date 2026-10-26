import { Plus } from 'lucide-react';
import { useState, type FocusEvent, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { TaskType } from '@msr/shared/enums';
import type { CreateTaskInput } from '@msr/shared/schemas/task';
import type { ProjectDetail } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { useConflictGuard } from '../../calendar/useConflictGuard';
import { useCreateTask } from '../api';
import { TaskCreateFields, type TaskCreateValues } from '../components/TaskCreateFields';

interface InlineTaskComposerProps {
  project: ProjectDetail;
  defaults: Omit<CreateTaskInput, 'title'>;
  types: readonly TaskType[];
}

const POPOVER_SELECTOR = '[data-radix-popper-content-wrapper]';

export function InlineTaskComposer({ project, defaults, types }: InlineTaskComposerProps) {
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    if (fields.dueDate && !(await guard({ userIds: [fields.assigneeId ?? user.id], date: fields.dueDate })))
      return;
    setTitle('');
    create.mutate(
      {
        ...defaults,
        projectKey: project.key,
        title: text,
        type: fields.type,
        priority: fields.priority,
        assigneeId: fields.assigneeId,
        dueDate: fields.dueDate,
        recurrence: fields.recurrence,
        labelIds: fields.labelIds,
        severity: fields.type === 'bug' ? fields.severity : null,
      },
      {
        onError: (error) => {
          setTitle(text);
          toast.error(errorMessage(error));
        },
      },
    );
  };

  const closeOnLeave = (event: FocusEvent<HTMLFormElement>) => {
    const next = event.relatedTarget as HTMLElement | null;
    if (title.trim() || event.currentTarget.contains(next) || next?.closest(POPOVER_SELECTOR)) return;
    setOpen(false);
  };

  const user = useCurrentUser();
  const guard = useConflictGuard();
  const create = useCreateTask();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<TaskCreateValues>({
    type: defaults.type ?? types[0]!,
    statusId: defaults.statusId ?? null,
    priority: defaults.priority ?? 'medium',
    assigneeId: defaults.assigneeId ?? null,
    dueDate: defaults.dueDate ?? null,
    recurrence: null,
    labelIds: defaults.labelIds ?? [],
    severity: null,
  });

  if (!open)
    return (
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Plus />}
        onClick={() => setOpen(true)}
        className="justify-start border-dashed bg-transparent text-muted shadow-none"
      >
        Add task
      </Button>
    );

  return (
    <form
      onSubmit={submit}
      onBlur={closeOnLeave}
      className="flex flex-col gap-2 rounded-[calc(var(--r-card)-4px)] border border-accent/50 bg-surface-raised p-2 shadow-card"
    >
      <textarea
        autoFocus
        rows={2}
        value={title}
        maxLength={300}
        placeholder="Task title, then press Enter"
        aria-label="Task title"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) submit(event);
          if (event.key === 'Escape') setOpen(false);
        }}
        className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-subtle"
      />
      <TaskCreateFields
        layout="compact"
        project={project}
        values={fields}
        onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
        fields={['type', 'priority', 'assignee', 'dueDate', 'recurrence', 'labels', 'severity']}
        types={types}
      />
      <div className="flex justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="xs" type="submit" loading={create.isPending} disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
}
