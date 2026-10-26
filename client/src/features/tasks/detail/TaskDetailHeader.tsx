import { Copy, Expand, GitBranch, MoreHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ProjectDetail, TaskDetail } from '@msr/shared/types';
import { IconButton } from '../../../components/ui/IconButton';
import { Menu } from '../../../components/ui/Menu';
import { TypeIcon } from '../taskMeta';
import { TaskActionsMenu, taskCopyItems } from './TaskActionsMenu';

interface TaskDetailHeaderProps {
  task: TaskDetail;
  project: ProjectDetail;
  actionsInBar?: boolean;
  onClose?: () => void;
  onNavigate: (identifier: string) => void;
}

export function TaskDetailHeader({
  task,
  project,
  actionsInBar,
  onClose,
  onNavigate,
}: TaskDetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 md:px-5">
      <TypeIcon type={task.type} />
      <span className="shrink-0 font-mono text-sm font-semibold whitespace-nowrap">{task.identifier}</span>
      {task.parent && (
        <button
          type="button"
          onClick={() => onNavigate(task.parent!.identifier)}
          className="flex min-w-0 cursor-pointer items-center gap-1 text-xs text-muted hover:text-text"
        >
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">
            {task.parent.identifier} {task.parent.title}
          </span>
        </button>
      )}
      <div className="flex-1" />
      {!actionsInBar && (
        <>
          <Menu trigger={<IconButton icon={<Copy />} label="Copy" />} items={taskCopyItems(task)} />
          {onClose && (
            <IconButton
              icon={<Expand />}
              label="Open full page"
              onClick={() => navigate(`/p/${task.projectKey}/${task.number}`)}
            />
          )}
          <TaskActionsMenu
            task={task}
            project={project}
            trigger={<IconButton icon={<MoreHorizontal />} label="More actions" />}
            onClose={onClose}
            onNavigate={onNavigate}
          />
        </>
      )}
      {onClose && <IconButton icon={<X />} label="Close" onClick={onClose} />}
    </div>
  );
}
