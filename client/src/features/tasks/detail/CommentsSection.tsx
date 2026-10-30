import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Comment } from '@msr/shared/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from '../collabApi';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';

interface CommentsSectionProps {
  taskId: string;
  canComment: boolean;
  canModerate: boolean;
  canUpload: boolean;
}

export function CommentsSection({ taskId, canComment, canModerate, canUpload }: CommentsSectionProps) {
  const remove = async (comment: Comment) => {
    const confirmed = await confirm({
      title: 'Delete this comment?',
      description: comment.parentId ? undefined : 'Its replies are deleted too.',
      confirmLabel: 'Delete',
    });
    if (confirmed) del.mutate(comment.id, { onError: (error) => toast.error(errorMessage(error)) });
  };

  const renderComment = (comment: Comment, replies: Comment[] = []) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      canReply={canComment && !comment.parentId}
      canManage={comment.author.id === user.id || canModerate}
      onReply={() => setReplyTo(comment.id)}
      onEdit={() => setEditingId(comment.id)}
      onDelete={() => remove(comment)}
      editing={
        editingId === comment.id ? (
          <CommentComposer
            initial={comment.body}
            submitLabel="Save"
            canUpload={canUpload}
            autoFocus
            loading={edit.isPending}
            onCancel={() => setEditingId(null)}
            onSubmit={(body, attachmentIds) =>
              edit.mutateAsync({ id: comment.id, body, attachmentIds }).then(() => setEditingId(null))
            }
          />
        ) : undefined
      }
    >
      {replies.map((reply) => renderComment(reply))}
      {replyTo === comment.id && (
        <CommentComposer
          placeholder="Write a reply…"
          submitLabel="Reply"
          canUpload={canUpload}
          autoFocus
          loading={create.isPending}
          onCancel={() => setReplyTo(null)}
          onSubmit={(body, attachmentIds) =>
            create.mutateAsync({ body, parentId: comment.id, attachmentIds }).then(() => setReplyTo(null))
          }
        />
      )}
    </CommentItem>
  );

  const user = useCurrentUser();
  const confirm = useConfirm();
  const comments = useComments(taskId);
  const create = useCreateComment(taskId);
  const edit = useUpdateComment(taskId);
  const del = useDeleteComment(taskId);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const all = comments.data ?? [];
  const roots = all.filter((comment) => !comment.parentId);

  return (
    <div className="flex flex-col gap-4">
      {comments.isPending && <Skeleton className="h-16" count={2} />}
      {!comments.isPending && !roots.length && (
        <EmptyState
          compact
          icon={<MessageSquare />}
          title="No comments yet"
          description={canComment ? 'Start the discussion below.' : undefined}
        />
      )}
      {roots.map((comment) =>
        renderComment(
          comment,
          all.filter((reply) => reply.parentId === comment.id),
        ),
      )}
      {canComment && (
        <CommentComposer
          canUpload={canUpload}
          loading={create.isPending}
          onSubmit={(body, attachmentIds) => create.mutateAsync({ body, attachmentIds })}
        />
      )}
    </div>
  );
}
