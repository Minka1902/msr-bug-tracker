import { useEffect } from 'react';
import { toast } from 'sonner';
import { can } from '@msr/shared/permissions';
import { ErrorState } from '../../../components/ui/ErrorState';
import { InlineText } from '../../../components/ui/InlineText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabs } from '../../../components/ui/Tabs';
import { ApiError, errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { useProject } from '../../projects/api';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useTaskByIdentifier, useTask, useUpdateTask } from '../api';
import { ActivityFeed } from './ActivityFeed';
import { AttachmentsSection } from './AttachmentsSection';
import { BugDetails } from './BugDetails';
import { ChecklistSection } from './ChecklistSection';
import { CommentsSection } from './CommentsSection';
import { DescriptionSection } from './DescriptionSection';
import { RelationsSection } from './RelationsSection';
import { SubtasksSection } from './SubtasksSection';
import { TaskDetailHeader } from './TaskDetailHeader';
import { TaskProperties } from './TaskProperties';

interface TaskDetailProps {
  identifier: string;
  variant?: 'peek' | 'page';
  onClose?: () => void;
  onNavigate: (identifier: string, options?: { replace?: boolean }) => void;
}

export function TaskDetail({ identifier, variant = 'peek', onClose, onNavigate }: TaskDetailProps) {
  const resolved = useTaskByIdentifier(identifier);
  const live = useTask(resolved.data?.id);
  const task = live.data ?? resolved.data;
  const project = useProject(task?.projectKey ?? '');
  const permissions = useProjectPermissions(project.data);
  const update = useUpdateTask();

  useEffect(() => {
    if (task && task.identifier !== identifier.toUpperCase()) onNavigate(task.identifier, { replace: true });
  }, [task, identifier, onNavigate]);

  if (resolved.error instanceof ApiError && resolved.error.status === 404)
    return (
      <NotFoundPage
        title="Task not found"
        description="It may have been deleted, or you don't have access."
      />
    );
  if (resolved.error) return <ErrorState error={resolved.error} onRetry={resolved.refetch} />;
  if (!task || !project.data)
    return (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-40" />
      </div>
    );

  const ownership = { reporterId: task.reporterId, assigneeId: task.assignee?.id ?? null };
  const canEdit = permissions.canEditTask(ownership);
  const canUpload = permissions.can('attachment.upload');
  const mask = project.data.isArchived ? 0 : project.data.permissions;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        variant === 'page' && 'rounded-card border border-border bg-surface-raised shadow-card',
      )}
    >
      <TaskDetailHeader task={task} project={project.data} onClose={onClose} onNavigate={onNavigate} />
      <div className="@container flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid gap-6 p-4 md:p-5 @2xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex min-w-0 flex-col gap-6">
            <InlineText
              multiline
              aria-label="Title"
              value={task.title}
              maxLength={300}
              disabled={!canEdit}
              onSave={(title) =>
                update.mutate(
                  { id: task.id, patch: { title }, optimistic: { title } },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
              className="-ml-2 font-display text-xl leading-snug font-bold md:text-2xl"
            />
            <div className="@2xl:hidden">
              <TaskProperties task={task} project={project.data} />
            </div>
            <DescriptionSection key={`d-${task.id}`} task={task} editable={canEdit} canUpload={canUpload} />
            {task.type === 'bug' && (
              <BugDetails key={`b-${task.id}`} task={task} editable={canEdit} canUpload={canUpload} />
            )}
            <SubtasksSection
              task={task}
              project={project.data}
              canCreate={permissions.can('task.create')}
              onOpen={onNavigate}
            />
            <ChecklistSection task={task} editable={canEdit} />
            <AttachmentsSection
              task={task}
              canUpload={canUpload}
              canDeleteAny={can(mask, 'attachment.delete_any')}
            />
            <RelationsSection task={task} editable={canEdit} onOpen={onNavigate} />
            <Tabs
              items={[
                {
                  value: 'comments',
                  label: 'Comments',
                  count: task.commentCount,
                  content: (
                    <div className="pt-4">
                      <CommentsSection
                        taskId={task.id}
                        canComment={permissions.can('comment.create')}
                        canModerate={permissions.can('comment.moderate')}
                        canUpload={canUpload}
                      />
                    </div>
                  ),
                },
                {
                  value: 'activity',
                  label: 'Activity',
                  content: (
                    <div className="pt-4">
                      <ActivityFeed taskId={task.id} />
                    </div>
                  ),
                },
              ]}
            />
          </div>
          <aside className="hidden @2xl:block">
            <div className="sticky top-0">
              <TaskProperties task={task} project={project.data} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
