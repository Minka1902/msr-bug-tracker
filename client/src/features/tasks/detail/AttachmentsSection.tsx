import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskDetail } from '@msr/shared/types';
import { FileDropzone } from '../../../components/ui/FileDropzone';
import { IconButton } from '../../../components/ui/IconButton';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { formatRelative } from '../../../lib/dates';
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

  if (!canUpload && !files.length) return null;

  return (
    <TextSection
      title="Attachments"
      icon={<Paperclip />}
      action={files.length > 0 && <span className="text-xs text-muted">{files.length}</span>}
    >
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="group relative overflow-hidden rounded-control border border-border bg-surface"
            >
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
                  <span className="text-[11px] text-subtle">
                    {formatSize(file.size)} · {formatRelative(file.createdAt)}
                  </span>
                </div>
              </a>
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
