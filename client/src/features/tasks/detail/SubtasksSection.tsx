import { GitBranch, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { ProjectDetail, TaskDetail } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { errorMessage } from '../../../lib/api';
import { useCreateTask, useSubtasks } from '../api';
import { TypeIcon } from '../taskMeta';
import { TextSection } from './TextSection';

interface SubtasksSectionProps {
  task: TaskDetail;
  project: ProjectDetail;
  canCreate: boolean;
  onOpen: (identifier: string) => void;
}

export function SubtasksSection({ task, project, canCreate, onOpen }: SubtasksSectionProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle('');
    create.mutate(
      {
        projectKey: task.projectKey,
        title: value,
        parentId: task.id,
        type: task.type === 'bug' ? 'bug' : 'task',
      },
      {
        onError: (error) => {
          setTitle(value);
          toast.error(errorMessage(error));
        },
      },
    );
  };

  const subtasks = useSubtasks(task.id, !task.parentId);
  const create = useCreateTask();
  const [title, setTitle] = useState('');

  if (task.parentId) return null;

  return (
    <TextSection
      title="Subtasks"
      icon={<GitBranch />}
      action={
        task.subtaskTotal > 0 && (
          <span className="text-xs text-muted tabular-nums">{`${task.subtaskDone}/${task.subtaskTotal}`}</span>
        )
      }
    >
      {task.subtaskTotal > 0 && (
        <ProgressBar value={(task.subtaskDone / task.subtaskTotal) * 100} size="xs" />
      )}
      <div className="flex flex-col">
        {subtasks.data?.map((subtask) => {
          const status = project.statuses.find((item) => item.id === subtask.statusId);
          return (
            <button
              key={subtask.id}
              type="button"
              onClick={() => onOpen(subtask.identifier)}
              className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
            >
              <TypeIcon type={subtask.type} className="size-3.5" />
              <span className="font-mono text-xs text-subtle">{subtask.identifier}</span>
              <span
                className={`flex-1 truncate ${subtask.statusCategory === 'done' ? 'text-muted line-through' : ''}`}
              >
                {subtask.title}
              </span>
              {status && <Badge size="xs" variant="dot" color={status.color} label={status.name} />}
              {subtask.assignee && (
                <Avatar name={subtask.assignee.name} src={subtask.assignee.avatarUrl} size="xs" />
              )}
            </button>
          );
        })}
      </div>
      {canCreate && (
        <form onSubmit={submit}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a subtask and press Enter"
            size="sm"
            leftIcon={<Plus />}
            maxLength={300}
          />
        </form>
      )}
    </TextSection>
  );
}
