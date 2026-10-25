import {
  ArrowRightLeft,
  Copy,
  CopyPlus,
  Expand,
  GitBranch,
  Link2,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { branchName } from '@msr/shared/identifiers';
import type { ProjectDetail, TaskDetail } from '@msr/shared/types';
import { IconButton } from '../../../components/ui/IconButton';
import { Menu } from '../../../components/ui/Menu';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { copyText } from '../../../lib/clipboard';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useDeleteTask, useDuplicateTask, useMoveTask, useReopenTask } from '../api';
import { TypeIcon } from '../taskMeta';
import { MoveTaskModal } from './MoveTaskModal';

interface TaskDetailHeaderProps {
  task: TaskDetail;
  project: ProjectDetail;
  onClose?: () => void;
  onNavigate: (identifier: string) => void;
}

const onError = (error: unknown) => toast.error(errorMessage(error));

export function TaskDetailHeader({ task, project, onClose, onNavigate }: TaskDetailHeaderProps) {
  const link = `${window.location.origin}/p/${task.projectKey}/${task.number}`;

  const remove = async () => {
    const confirmed = await confirm({
      title: `Delete ${task.identifier}?`,
      description: task.subtaskTotal
        ? `Its ${task.subtaskTotal} subtasks, comments and files are deleted too.`
        : 'Its comments and files are deleted too.',
      confirmLabel: 'Delete task',
    });
    if (!confirmed) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success(`${task.identifier} deleted`);
        if (onClose) onClose();
        else navigate(`/p/${task.projectKey}/list`);
      },
      onError,
    });
  };

  const duplicate = () =>
    duplicateTask.mutate(task.id, {
      onSuccess: (copy) => {
        toast.success(`Duplicated as ${copy!.identifier}`);
        onNavigate(copy!.identifier);
      },
      onError,
    });

  const confirm = useConfirm();
  const navigate = useNavigate();
  const permissions = useProjectPermissions(project);
  const deleteTask = useDeleteTask();
  const duplicateTask = useDuplicateTask();
  const reopen = useReopenTask();
  const move = useMoveTask();
  const [moving, setMoving] = useState(false);

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 md:px-5">
      <TypeIcon type={task.type} />
      <span className="font-mono text-sm font-semibold">{task.identifier}</span>
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
      <Menu
        trigger={<IconButton icon={<Copy />} label="Copy" />}
        items={[
          { label: 'Copy link', icon: <Link2 />, onSelect: () => copyText(link, 'Link') },
          { label: 'Copy ID', icon: <Copy />, onSelect: () => copyText(task.identifier, 'ID') },
          {
            label: 'Copy git branch name',
            icon: <GitBranch />,
            onSelect: () => copyText(branchName(task.projectKey, task.number, task.title), 'Branch name'),
          },
        ]}
      />
      {onClose && (
        <IconButton
          icon={<Expand />}
          label="Open full page"
          onClick={() => navigate(`/p/${task.projectKey}/${task.number}`)}
        />
      )}
      <Menu
        trigger={<IconButton icon={<MoreHorizontal />} label="More actions" />}
        items={[
          {
            label: 'Reopen',
            icon: <RotateCcw />,
            hidden: task.statusCategory !== 'done' || !permissions.can('task.transition'),
            onSelect: () => reopen.mutate(task.id, { onError }),
          },
          {
            label: 'Duplicate',
            icon: <CopyPlus />,
            hidden: !permissions.can('task.create'),
            onSelect: duplicate,
          },
          {
            label: 'Move to project…',
            icon: <ArrowRightLeft />,
            hidden: !permissions.can('task.move'),
            onSelect: () => setMoving(true),
          },
          { type: 'separator', hidden: !permissions.can('task.delete') },
          {
            label: 'Delete',
            icon: <Trash2 />,
            danger: true,
            hidden: !permissions.can('task.delete'),
            onSelect: remove,
          },
        ]}
      />
      {onClose && <IconButton icon={<X />} label="Close" onClick={onClose} />}
      <MoveTaskModal
        task={moving ? task : null}
        loading={move.isPending}
        onCancel={() => setMoving(false)}
        onConfirm={(projectKey) =>
          move.mutate(
            { id: task.id, projectKey },
            {
              onSuccess: (moved) => {
                setMoving(false);
                toast.success(`Moved to ${moved!.identifier}`);
                navigate(`/p/${moved!.projectKey}/${moved!.number}`);
              },
              onError,
            },
          )
        }
      />
    </div>
  );
}
