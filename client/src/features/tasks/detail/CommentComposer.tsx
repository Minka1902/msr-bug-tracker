import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { errorMessage } from '../../../lib/api';
import { uploadFiles } from '../collabApi';

interface CommentComposerProps {
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
  canUpload: boolean;
  autoFocus?: boolean;
  loading?: boolean;
  onSubmit: (body: string, attachmentIds: string[]) => Promise<unknown>;
  onCancel?: () => void;
}

export function CommentComposer({
  initial = '',
  placeholder = 'Write a comment… (Ctrl+Enter to send)',
  submitLabel = 'Comment',
  canUpload,
  autoFocus,
  loading,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const submit = async () => {
    if (!body.trim()) return;
    try {
      await onSubmit(body.trim(), attachmentIds);
      setBody('');
      setAttachmentIds([]);
      setVersion((current) => current + 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const upload = async (files: File[]) => {
    const uploaded = await uploadFiles(files);
    setAttachmentIds((current) => [...current, ...uploaded.map((file) => file.id)]);
    return uploaded;
  };

  const [body, setBody] = useState(initial);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  return (
    <div className="flex flex-col gap-2">
      <RichTextEditor
        key={version}
        aria-label="Comment"
        value={initial}
        onChange={setBody}
        onSubmit={submit}
        onUpload={canUpload ? upload : undefined}
        placeholder={placeholder}
        autoFocus={autoFocus}
        minHeight={64}
        toolbar={false}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={submit} loading={loading} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
