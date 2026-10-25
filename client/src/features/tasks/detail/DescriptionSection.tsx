import { AlignLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskDetail } from '@msr/shared/types';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { errorMessage } from '../../../lib/api';
import { useUpdateTask } from '../api';
import { uploadFiles } from '../collabApi';
import { TextSection } from './TextSection';

interface DescriptionSectionProps {
  task: TaskDetail;
  editable: boolean;
  canUpload: boolean;
}

export function DescriptionSection({ task, editable, canUpload }: DescriptionSectionProps) {
  const update = useUpdateTask();

  return (
    <TextSection title="Description" icon={<AlignLeft />}>
      {!editable && !task.description ? (
        <p className="text-sm text-subtle">No description.</p>
      ) : (
        <RichTextEditor
          aria-label="Description"
          value={task.description}
          editable={editable}
          placeholder="Add details, acceptance criteria, or paste a screenshot…"
          minHeight={120}
          onUpload={canUpload ? (files) => uploadFiles(files, task.id) : undefined}
          onSave={(description) =>
            update.mutate(
              { id: task.id, patch: { description } },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        />
      )}
    </TextSection>
  );
}
