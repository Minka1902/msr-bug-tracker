import { Bug } from 'lucide-react';
import { toast } from 'sonner';
import type { UpdateTaskInput } from '@msr/shared/schemas/task';
import type { TaskDetail } from '@msr/shared/types';
import { InlineText } from '../../../components/ui/InlineText';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { errorMessage } from '../../../lib/api';
import { useUpdateTask } from '../api';
import { uploadFiles } from '../collabApi';
import { PropertyRow } from './PropertyRow';
import { TextSection } from './TextSection';

interface BugDetailsProps {
  task: TaskDetail;
  editable: boolean;
  canUpload: boolean;
}

const LONG_FIELDS = [
  { key: 'stepsToReproduce', label: 'Steps to reproduce', placeholder: '1. Open…\n2. Click…' },
  { key: 'expectedBehavior', label: 'Expected behavior', placeholder: 'What should happen?' },
  {
    key: 'actualBehavior',
    label: 'Actual behavior',
    placeholder: 'What happens instead? Paste a screenshot or log.',
  },
] as const;

const SHORT_FIELDS = [
  { key: 'envOs', label: 'OS', placeholder: 'iOS 18.2, Windows 11…' },
  { key: 'envBrowser', label: 'Browser', placeholder: 'Safari 18, Chrome 131…' },
  { key: 'envAppVersion', label: 'App version', placeholder: '2.4.1' },
  { key: 'foundInVersion', label: 'Found in', placeholder: 'Build or version' },
  { key: 'fixVersion', label: 'Fix version', placeholder: 'Planned release' },
] as const;

export function BugDetails({ task, editable, canUpload }: BugDetailsProps) {
  const save = (patch: UpdateTaskInput) =>
    update.mutate(
      { id: task.id, patch, optimistic: patch as Partial<TaskDetail> },
      { onError: (error) => toast.error(errorMessage(error)) },
    );

  const update = useUpdateTask();

  return (
    <TextSection title="Bug report" icon={<Bug />}>
      <div className="flex flex-col gap-4 rounded-card border border-border p-3">
        {LONG_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">{field.label}</span>
            {!editable && !task[field.key] ? (
              <p className="text-sm text-subtle">Not provided.</p>
            ) : (
              <RichTextEditor
                aria-label={field.label}
                value={task[field.key]}
                editable={editable}
                toolbar={false}
                minHeight={56}
                placeholder={field.placeholder}
                onUpload={canUpload ? (files) => uploadFiles(files, task.id) : undefined}
                onSave={(value) => save({ [field.key]: value })}
              />
            )}
          </div>
        ))}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {SHORT_FIELDS.map((field) => (
            <PropertyRow key={field.key} label={field.label}>
              <InlineText
                aria-label={field.label}
                value={task[field.key]}
                placeholder={editable ? field.placeholder : '—'}
                allowEmpty
                maxLength={120}
                disabled={!editable}
                onSave={(value) => save({ [field.key]: value })}
              />
            </PropertyRow>
          ))}
        </div>
      </div>
    </TextSection>
  );
}
