import { ArrowRightLeft, Copy, CopyPlus, GitBranch, Link2, RotateCcw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { branchName } from '@msr/shared/identifiers';
import type { ProjectDetail, TaskDetail } from '@msr/shared/types';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { copyText } from '../../../lib/clipboard';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useDeleteTask, useDuplicateTask, useMoveTask, useReopenTask } from '../api';
import { MoveTaskModal } from './MoveTaskModal';

interface TaskActionsMenuProps {
  task: TaskDetail;
  project: ProjectDetail;
  trigger: ReactNode;
  withCopy?: boolean;
  onClose?: () => void;
  onNavigate: (identifier: string) => void;
}

const onError = (error: unknown) => toast.error(errorMessage(error));

export const taskCopyItems = (task: TaskDetail): MenuItem[] => [
  {
    label: 'Copy link',
    icon: <Link2 />,
    onSelect: () => copyText(`${window.location.origin}/p/${task.projectKey}/${task.number}`, 'Link'),
  },
  { label: 'Copy ID', icon: <Copy />, onSelect: () => copyText(task.identifier, 'ID') },
  {
    label: 'Copy git branch name',
    icon: <GitBranch />,
    onSelect: () => copyText(branchName(task.projectKey, task.number, task.title), 'Branch name'),
  },
];

export function TaskActionsMenu({
  task,
  project,
  trigger,
  withCopy,
  onClose,
  onNavigate,
}: TaskActionsMenuProps) {
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

  const actionItems: MenuItem[] = [
    {
      label: 'Reopen',
      icon: <RotateCcw />,
      hidden:
        task.statusCategory !== 'done' ||
        !permissions.canTransition({ assigneeId: task.assignee?.id ?? null }),
      onSelect: () => reopen.mutate(task.id, { onError }),
    },
    { label: 'Duplicate', icon: <CopyPlus />, hidden: !permissions.can('task.create'), onSelect: duplicate },
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
  ];
  const items = withCopy
    ? [...taskCopyItems(task), { type: 'separator' } as const, ...actionItems]
    : actionItems;

  return (
    <>
      <Menu title={task.identifier} trigger={trigger} items={items} />
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
    </>
  );
}
