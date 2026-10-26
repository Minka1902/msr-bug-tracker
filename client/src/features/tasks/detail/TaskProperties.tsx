import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectDetail, TaskDetail } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { InlineText } from '../../../components/ui/InlineText';
import { Switch } from '../../../components/ui/Switch';
import { errorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/dates';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useUpdateTask } from '../api';
import { EscalationPicker } from '../components/EscalationPicker';
import { RecurrencePicker } from '../components/RecurrencePicker';
import { TaskPropertyPicker } from '../components/TaskPropertyPicker';
import { PropertyRow } from './PropertyRow';

interface TaskPropertiesProps {
  task: TaskDetail;
  project: ProjectDetail;
}

export function TaskProperties({ task, project }: TaskPropertiesProps) {
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate(
      { id: task.id, patch, optimistic: patch as Partial<TaskDetail> },
      { onError: (error) => toast.error(errorMessage(error)) },
    );

  const permissions = useProjectPermissions(project);
  const update = useUpdateTask();
  const canEdit = permissions.canEditTask({
    reporterId: task.reporterId,
    assigneeId: task.assignee?.id ?? null,
  });
  const isBug = task.type === 'bug';

  return (
    <div className="flex flex-col gap-1.5">
      <PropertyRow label="Status">
        <TaskPropertyPicker task={task} field="status" project={project} variant="field" />
      </PropertyRow>
      <PropertyRow label="Assignee">
        <TaskPropertyPicker task={task} field="assignee" project={project} variant="field" />
      </PropertyRow>
      <PropertyRow label="Priority">
        <TaskPropertyPicker task={task} field="priority" project={project} variant="field" />
      </PropertyRow>
      <PropertyRow label="Type">
        <TaskPropertyPicker task={task} field="type" project={project} variant="field" />
      </PropertyRow>
      {isBug && (
        <>
          <PropertyRow label="Severity">
            <TaskPropertyPicker task={task} field="severity" project={project} variant="field" />
          </PropertyRow>
          <PropertyRow label="Reproducible">
            <TaskPropertyPicker task={task} field="reproducibility" project={project} variant="field" />
          </PropertyRow>
        </>
      )}
      <PropertyRow label="Labels">
        <TaskPropertyPicker task={task} field="labels" project={project} variant="field" />
      </PropertyRow>
      <PropertyRow label="Start date">
        <TaskPropertyPicker task={task} field="startDate" project={project} variant="field" />
      </PropertyRow>
      <PropertyRow label="Due date">
        <TaskPropertyPicker task={task} field="dueDate" project={project} variant="field" />
      </PropertyRow>
      {task.dueDate && (
        <PropertyRow label="Escalate">
          <EscalationPicker
            value={task.escalation}
            onChange={(escalation) => save({ escalation })}
            startDate={task.startDate}
            dueDate={task.dueDate}
            disabled={!canEdit}
            className="h-9 w-full border-transparent bg-transparent px-2.5"
          />
        </PropertyRow>
      )}
      <PropertyRow label="Repeat">
        <RecurrencePicker
          value={task.recurrence}
          onChange={(recurrence) => save({ recurrence })}
          members={project.memberList}
          disabled={!canEdit}
          className="h-9 w-full border-transparent bg-transparent px-2.5"
        />
      </PropertyRow>
      <PropertyRow label="Blocked">
        <div className="flex h-9 items-center gap-2 px-2.5">
          <Switch
            size="sm"
            aria-label="Blocked"
            checked={task.isBlocked}
            disabled={!canEdit}
            onCheckedChange={(isBlocked) => save({ isBlocked, ...(!isBlocked && { blockedReason: null }) })}
          />
          {task.isBlocked && <Ban className="size-4 text-danger" />}
        </div>
      </PropertyRow>
      {task.isBlocked && (
        <PropertyRow label="Blocked by">
          <InlineText
            aria-label="Blocked reason"
            value={task.blockedReason ?? ''}
            placeholder="What is it waiting on?"
            allowEmpty
            maxLength={500}
            disabled={!canEdit}
            onSave={(blockedReason) => save({ blockedReason: blockedReason || null })}
          />
        </PropertyRow>
      )}
      <PropertyRow label="Reporter">
        {task.reporter ? (
          <span className="flex items-center gap-2 px-2.5 text-sm">
            <Avatar name={task.reporter.name} src={task.reporter.avatarUrl} size="sm" decorative />
            {task.reporter.name}
          </span>
        ) : (
          <span className="px-2.5 text-sm text-subtle">Unknown</span>
        )}
      </PropertyRow>
      <div className="mt-2 flex flex-col gap-1 border-t border-border pt-3 text-xs text-subtle">
        <span>Created {formatDateTime(task.createdAt)}</span>
        <span>Updated {formatDateTime(task.updatedAt)}</span>
        {task.completedAt && <span>Completed {formatDateTime(task.completedAt)}</span>}
      </div>
    </div>
  );
}
