import type { ReactNode } from 'react';
import { Tag, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  PRIORITY_META,
  REPRODUCIBILITY_META,
  SEVERITY_META,
  TYPE_META,
  workflowOf,
  type Priority,
  type Reproducibility,
  type Severity,
  type TaskType,
} from '@msr/shared/enums';
import type { UpdateTaskInput } from '@msr/shared/schemas/task';
import type { ProjectDetail, TaskCard, TaskDetail } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { DatePicker } from '../../../components/ui/DatePicker';
import { OptionDot, OptionPicker, type PickerOption } from '../../../components/ui/OptionPicker';
import { Tooltip } from '../../../components/ui/Tooltip';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { useConflictGuard } from '../../calendar/useConflictGuard';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useUpdateTask } from '../api';
import { PriorityIcon, TypeIcon } from '../taskMeta';
import { UNASSIGNED, useTaskOptions } from '../useTaskOptions';
import { DueDate } from './DueDate';

export type TaskField =
  | 'status'
  | 'priority'
  | 'type'
  | 'severity'
  | 'reproducibility'
  | 'assignee'
  | 'labels'
  | 'startDate'
  | 'dueDate';

interface TaskPropertyPickerProps {
  task: TaskCard & Partial<Pick<TaskDetail, 'reproducibility'>>;
  field: TaskField;
  project: ProjectDetail;
  variant?: 'cell' | 'field';
  className?: string;
}

const FIELD_LABELS: Record<TaskField, string> = {
  status: 'Status',
  priority: 'Priority',
  type: 'Type',
  severity: 'Severity',
  reproducibility: 'Reproducibility',
  assignee: 'Assignee',
  labels: 'Labels',
  startDate: 'Start date',
  dueDate: 'Due date',
};

const TRIGGER = {
  cell: 'h-8 max-w-full rounded-[calc(var(--r-control)-3px)] px-2 hover:bg-surface-muted',
  field: 'h-9 w-full rounded-control px-2.5 hover:bg-surface-muted',
};

const EMPTY = <span className="text-subtle">None</span>;

export function TaskPropertyPicker({
  task,
  field,
  project,
  variant = 'cell',
  className,
}: TaskPropertyPickerProps) {
  const save = (patch: UpdateTaskInput, optimistic: Partial<TaskCard> = patch as Partial<TaskCard>) =>
    update.mutate(
      { id: task.id, patch, optimistic },
      { onError: (error) => toast.error(errorMessage(error)) },
    );

  const trigger = (content: ReactNode) => (
    <button
      type="button"
      onClick={(event) => event.stopPropagation()}
      disabled={disabled}
      className={cn(
        'inline-flex min-w-0 cursor-pointer items-center gap-2 text-left text-sm transition-colors disabled:cursor-default disabled:hover:bg-transparent',
        TRIGGER[variant],
        className,
      )}
    >
      <span className="sr-only">{`${FIELD_LABELS[field]} of ${task.identifier}: `}</span>
      {content}
    </button>
  );

  const clashFree = (userId: string | null, date: string | null) =>
    !date || !userId ? Promise.resolve(true) : guard({ userIds: [userId], date });

  const user = useCurrentUser();
  const guard = useConflictGuard();
  const options = useTaskOptions(project);
  const permissions = useProjectPermissions(project);
  const update = useUpdateTask();

  const ownership = { reporterId: task.reporterId, assigneeId: task.assignee?.id ?? null };
  const deadlineOwner = task.assignee?.id ?? task.reporterId;
  const canEdit = permissions.canEditTask(ownership);
  const canAssignOthers = permissions.canAssign(task.assignee?.id ?? null, '__other__');
  const canAssignSelf = permissions.canAssign(task.assignee?.id ?? null, user.id);
  const disabled =
    field === 'status'
      ? !permissions.can('task.transition')
      : field === 'assignee'
        ? !canAssignOthers && !canAssignSelf
        : !canEdit;
  const reason = permissions.deniedReason;

  if (field === 'startDate' || field === 'dueDate') {
    const value = task[field];
    return (
      <Tooltip content={disabled ? reason : undefined}>
        <span className="min-w-0">
          <DatePicker
            value={value}
            disabled={disabled}
            min={field === 'dueDate' ? task.startDate : null}
            max={field === 'startDate' ? task.dueDate : null}
            onChange={async (next) => {
              if (field === 'startDate' || (await clashFree(deadlineOwner, next))) save({ [field]: next });
            }}
            renderTrigger={() =>
              trigger(
                value ? (
                  field === 'dueDate' ? (
                    <DueDate date={value} done={task.statusCategory === 'done'} />
                  ) : (
                    <span>{value}</span>
                  )
                ) : (
                  <span className="text-subtle">No date</span>
                ),
              )
            }
          />
        </span>
      </Tooltip>
    );
  }

  if (field === 'labels') {
    return (
      <OptionPicker
        multiple
        searchable
        value={task.labels.map((label) => label.id)}
        disabled={disabled}
        disabledReason={reason}
        options={options.label}
        emptyText="No labels yet"
        onChange={(ids) =>
          save({ labelIds: ids }, { labels: project.labels.filter((label) => ids.includes(label.id)) })
        }
        renderTrigger={() =>
          trigger(
            task.labels.length ? (
              <span className="flex min-w-0 flex-wrap gap-1">
                {task.labels.map((label) => (
                  <Badge key={label.id} size="xs" color={label.color} label={label.name} />
                ))}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-subtle">
                <Tag className="size-3.5" />
                Add labels
              </span>
            ),
          )
        }
      />
    );
  }

  if (field === 'assignee') {
    const choices: PickerOption[] = [
      { value: UNASSIGNED, label: 'Unassigned', icon: <UserRound className="size-4 text-subtle" /> },
      ...options.assignee.filter((option) => canAssignOthers || option.value === user.id),
    ];
    return (
      <OptionPicker
        searchable
        value={task.assignee?.id ?? UNASSIGNED}
        disabled={disabled}
        disabledReason={reason}
        options={choices}
        onChange={async (id) => {
          const member = project.memberList.find((item) => item.id === id);
          const owner = member?.id ?? task.reporterId;
          if (owner !== deadlineOwner && !(await clashFree(owner, task.dueDate))) return;
          save(
            { assigneeId: member?.id ?? null },
            { assignee: member ? { id: member.id, name: member.name, avatarUrl: member.avatarUrl } : null },
          );
        }}
        renderTrigger={() =>
          trigger(
            task.assignee ? (
              <>
                <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" decorative />
                <span className="truncate">{task.assignee.name}</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-subtle">
                <UserRound className="size-4" />
                Unassigned
              </span>
            ),
          )
        }
      />
    );
  }

  if (field === 'status') {
    const status = project.statuses.find((item) => item.id === task.statusId);
    return (
      <OptionPicker
        value={task.statusId}
        disabled={disabled}
        disabledReason={reason}
        options={options.status(workflowOf(task.type))}
        onChange={(id) => {
          const next = project.statuses.find((item) => item.id === id);
          if (next) save({ statusId: next.id }, { statusId: next.id, statusCategory: next.category });
        }}
        renderTrigger={() =>
          trigger(
            <Badge
              variant="soft"
              color={status?.color}
              icon={<OptionDot color={status?.color} />}
              label={status?.name ?? '—'}
            />,
          )
        }
      />
    );
  }

  const config = {
    priority: {
      value: task.priority as string,
      options: options.priority,
      display: (
        <span className="flex items-center gap-2">
          <PriorityIcon priority={task.priority} decorative />
          {PRIORITY_META[task.priority].label}
        </span>
      ),
      patch: (value: string) => ({ priority: value as Priority }),
    },
    type: {
      value: task.type as string,
      options: options.type,
      display: (
        <span className="flex items-center gap-2">
          <TypeIcon type={task.type} />
          {TYPE_META[task.type].label}
        </span>
      ),
      patch: (value: string) => ({ type: value as TaskType }),
    },
    severity: {
      value: task.severity as string | null,
      options: options.severity,
      display: task.severity ? (
        <Badge tone={SEVERITY_META[task.severity].tone} label={SEVERITY_META[task.severity].label} />
      ) : (
        EMPTY
      ),
      patch: (value: string | null) => ({ severity: value as Severity | null }),
    },
    reproducibility: {
      value: (task.reproducibility ?? null) as string | null,
      options: options.reproducibility,
      display: task.reproducibility ? REPRODUCIBILITY_META[task.reproducibility].label : EMPTY,
      patch: (value: string | null) => ({ reproducibility: value as Reproducibility | null }),
    },
  }[field];

  return (
    <OptionPicker
      value={config.value}
      clearable={field === 'severity' || field === 'reproducibility'}
      disabled={disabled}
      disabledReason={reason}
      options={config.options}
      onChange={(value) => save(config.patch(value as string))}
      renderTrigger={() => trigger(config.display)}
    />
  );
}
