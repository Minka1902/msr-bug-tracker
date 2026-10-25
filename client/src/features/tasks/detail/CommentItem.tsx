import { Pencil, Reply, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Comment } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { IconButton } from '../../../components/ui/IconButton';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { formatDateTime, formatRelative } from '../../../lib/dates';

interface CommentItemProps {
  comment: Comment;
  canReply: boolean;
  canManage: boolean;
  editing?: ReactNode;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode;
}

export function CommentItem({
  comment,
  canReply,
  canManage,
  editing,
  onReply,
  onEdit,
  onDelete,
  children,
}: CommentItemProps) {
  return (
    <div className="flex gap-3">
      <Avatar name={comment.author.name} src={comment.author.avatarUrl} size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="group rounded-card border border-border bg-surface px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-sm font-semibold">{comment.author.name}</span>
            <span title={formatDateTime(comment.createdAt)} className="text-subtle">
              {formatRelative(comment.createdAt)}
            </span>
            {comment.editedAt && <span className="text-subtle">· edited</span>}
            <span className="flex-1" />
            <span className="flex opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
              {canReply && <IconButton icon={<Reply />} label="Reply" size="xs" onClick={onReply} />}
              {canManage && <IconButton icon={<Pencil />} label="Edit comment" size="xs" onClick={onEdit} />}
              {canManage && (
                <IconButton
                  icon={<Trash2 />}
                  label="Delete comment"
                  size="xs"
                  variant="danger-ghost"
                  onClick={onDelete}
                />
              )}
            </span>
          </div>
          {editing ?? <RichTextEditor value={comment.body} editable={false} />}
        </div>
        {children}
      </div>
    </div>
  );
}
