import { ExternalLink } from 'lucide-react';
import type { TaskCard } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useProject } from '../../projects/api';
import { useTaskPeek } from '../useTaskPeek';
import { TaskPropertyPicker, type TaskField } from './TaskPropertyPicker';

const FIELDS: { field: TaskField; label: string }[] = [
  { field: 'status', label: 'Status' },
  { field: 'assignee', label: 'Assignee' },
  { field: 'dueDate', label: 'Due date' },
  { field: 'priority', label: 'Priority' },
];

interface TaskQuickActionsProps {
  task: TaskCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskQuickActions({ task, open, onOpenChange }: TaskQuickActionsProps) {
  const project = useProject(open ? task.projectKey : '');
  const peek = useTaskPeek();

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={task.title}
      description={task.identifier}
      footer={
        <Button
          variant="secondary"
          leftIcon={<ExternalLink />}
          onClick={() => {
            onOpenChange(false);
            peek.open(task.identifier);
          }}
        >
          Open task
        </Button>
      }
    >
      {project.data ? (
        <dl className="flex flex-col divide-y divide-border">
          {FIELDS.map(({ field, label }) => (
            <div key={field} className="flex min-h-(--tap) items-center gap-3 py-1">
              <dt className="w-24 shrink-0 text-sm text-muted">{label}</dt>
              <dd className="min-w-0 flex-1">
                <TaskPropertyPicker task={task} field={field} project={project.data} variant="field" />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton className="h-11" count={4} />
      )}
    </Sheet>
  );
}
