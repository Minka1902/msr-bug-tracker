import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { TaskDetail } from '@msr/shared/types';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { useUpdateTask } from '../api';
import { uploadFiles } from '../collabApi';
import { TextSection } from './TextSection';

type TextField = 'description' | 'decision';

interface TaskTextSectionProps {
  task: TaskDetail;
  field: TextField;
  title: string;
  icon: ReactNode;
  placeholder: string;
  emptyText: string;
  editable: boolean;
  canUpload: boolean;
  minHeight?: number;
  highlight?: boolean;
  className?: string;
}

export function TaskTextSection({
  task,
  field,
  title,
  icon,
  placeholder,
  emptyText,
  editable,
  canUpload,
  minHeight = 120,
  highlight,
  className,
}: TaskTextSectionProps) {
  const update = useUpdateTask();

  return (
    <div className={cn(highlight && 'rounded-card border border-(--tone-success) p-3', className)}>
      <TextSection title={title} icon={icon}>
        {!editable && !task[field] ? (
          <p className="text-sm text-subtle">{emptyText}</p>
        ) : (
          <RichTextEditor
            aria-label={title}
            value={task[field]}
            editable={editable}
            placeholder={placeholder}
            minHeight={minHeight}
            onUpload={canUpload ? (files) => uploadFiles(files, task.id) : undefined}
            onSave={(value) =>
              update.mutate(
                { id: task.id, patch: { [field]: value } },
                { onError: (error) => toast.error(errorMessage(error)) },
              )
            }
          />
        )}
      </TextSection>
    </div>
  );
}
