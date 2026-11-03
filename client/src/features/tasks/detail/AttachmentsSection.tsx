import { FileText, FileX, Hourglass, ImageOff, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ATTACHMENT_RETENTION_DAYS, fileDeletesAt } from '@msr/shared/attachments';
import type { Attachment, TaskDetail } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { FileDropzone } from '../../../components/ui/FileDropzone';
import { IconButton } from '../../../components/ui/IconButton';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { formatRelative, formatShortDate } from '../../../lib/dates';
import { cn } from '../../../lib/cn';
import { useAttachments, useDeleteAttachment, useUploadAttachments } from '../collabApi';
import { TextSection } from './TextSection';

interface AttachmentsSectionProps {
  task: TaskDetail;
  canUpload: boolean;
  canDeleteAny: boolean;
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function AttachmentsSection({ task, canUpload, canDeleteAny }: AttachmentsSectionProps) {
  const fileNote = (file: Attachment) => {
    if (file.purgedAt) return `Deleted ${formatShortDate(file.purgedAt)}`;
    const size = formatSize(file.size);
    return task.completedAt
      ? `${size} · deleted ${formatShortDate(fileDeletesAt(task.completedAt, file.createdAt))}`
      : `${size} · ${formatRelative(file.createdAt)}`;
  };

  const remove = async (id: string, name: string) => {
    if (await confirm({ title: `Delete ${name}?`, confirmLabel: 'Delete file' }))
      del.mutate(id, { onError: (error) => toast.error(errorMessage(error)) });
  };

  const user = useCurrentUser();
  const confirm = useConfirm();
  const attachments = useAttachments(task.id);
  const upload = useUploadAttachments(task.id);
  const del = useDeleteAttachment(task.id);
  const files = attachments.data ?? [];
  const live = files.filter((file) => !file.purgedAt).length;

  if (!canUpload && !files.length) return null;

  return (
    <TextSection
      title="Attachments"
      icon={<Paperclip />}
      action={live > 0 && <span className="text-xs text-muted">{live}</span>}
    >
      {task.completedAt && live > 0 && (
        <Banner tone="warning" icon={<Hourglass />}>
          Files are deleted {ATTACHMENT_RETENTION_DAYS} days after the card is done. Reopen it to keep them.
        </Banner>
      )}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                'group relative overflow-hidden rounded-control border border-border bg-surface',
                file.purgedAt && 'border-dashed opacity-70',
              )}
            >
              {file.purgedAt ? (
                <div>
                  <div className="flex aspect-video items-center justify-center bg-surface-muted">
                    {file.mime.startsWith('image/') ? (
                      <ImageOff className="size-8 text-subtle" />
                    ) : (
                      <FileX className="size-8 text-subtle" />
                    )}
                  </div>
                  <div className="flex flex-col px-2 py-1.5">
                    <span className="truncate text-xs font-medium line-through">{file.name}</span>
                    <span className="text-[11px] text-subtle">{fileNote(file)}</span>
                  </div>
                </div>
              ) : (
                <a href={file.url} target="_blank" rel="noreferrer" className="block">
                  {file.mime.startsWith('image/') ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-surface-muted">
                      <FileText className="size-8 text-subtle" />
                    </div>
                  )}
                  <div className="flex flex-col px-2 py-1.5">
                    <span className="truncate text-xs font-medium">{file.name}</span>
                    <span className="text-[11px] text-subtle">{fileNote(file)}</span>
                  </div>
                </a>
              )}
              {(canDeleteAny || file.uploader.id === user.id) && (
                <IconButton
                  icon={<Trash2 />}
                  label={`Delete ${file.name}`}
                  size="xs"
                  variant="secondary"
                  onClick={() => remove(file.id, file.name)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 max-md:opacity-100"
                />
              )}
            </div>
          ))}
        </div>
      )}
      {canUpload && (
        <FileDropzone
          loading={upload.isPending}
          onFiles={(selected) =>
            upload.mutate(selected, { onError: (error) => toast.error(errorMessage(error)) })
          }
          hint="Drop screenshots, videos, logs or PDFs — or click to browse"
        />
      )}
    </TextSection>
  );
}
