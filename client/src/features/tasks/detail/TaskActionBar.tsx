import { MessageSquare, MoreHorizontal } from 'lucide-react';
import type { ProjectDetail, TaskDetail } from '@msr/shared/types';
import { TaskPropertyPicker } from '../components/TaskPropertyPicker';
import { TaskActionsMenu } from './TaskActionsMenu';

const ACTION =
  'flex h-(--tap) w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control text-[11px] text-muted active:bg-surface-muted [&_svg]:size-5';

interface TaskActionBarProps {
  task: TaskDetail;
  project: ProjectDetail;
  onComment: () => void;
  onClose?: () => void;
  onNavigate: (identifier: string) => void;
}

export function TaskActionBar({ task, project, onComment, onClose, onNavigate }: TaskActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Task actions"
      className="grid shrink-0 grid-cols-[1.4fr_1.2fr_1.2fr_1fr_1fr] gap-1 border-t border-border bg-surface px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]"
    >
      <TaskPropertyPicker task={task} field="status" project={project} variant="bar" />
      <TaskPropertyPicker task={task} field="assignee" project={project} variant="bar" />
      <TaskPropertyPicker task={task} field="dueDate" project={project} variant="bar" />
      <button type="button" onClick={onComment} className={ACTION}>
        <MessageSquare />
        Comment
      </button>
      <TaskActionsMenu
        task={task}
        project={project}
        withCopy
        onClose={onClose}
        onNavigate={onNavigate}
        trigger={
          <button type="button" className={ACTION}>
            <MoreHorizontal />
            More
          </button>
        }
      />
    </div>
  );
}
