import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { AI_INSTRUCTIONS_MAX, aiInstructionsSchema } from '@msr/shared/schemas/project';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Textarea';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useUpdateProject } from '../api';
import { useProjectContext } from '../useProjectContext';

const FIELDS = [
  {
    name: 'start',
    label: 'Before you start',
    hint: 'Comes before every answer the AI gets from this project.',
    placeholder: 'Move a task to In Progress before you work on it. Read the comments first.',
  },
  {
    name: 'finish',
    label: 'When you finish',
    hint: 'Comes after every answer, so it is the last thing the AI reads.',
    placeholder:
      'Comment with what you did, move the task to In Review, and create a task assigned to me for anything I need to do.',
  },
] as const;

export function AiInstructionSettings() {
  const submit = (event: FormEvent) =>
    form.handleSubmit((aiInstructions) =>
      update.mutate(
        { aiInstructions },
        {
          onSuccess: () => {
            form.reset(aiInstructions);
            toast.success('AI instructions saved');
          },
          onError: (error) => toast.error(errorMessage(error)),
        },
      ),
    )(event);

  const project = useProjectContext();
  const update = useUpdateProject(project.key);
  const form = useZodForm(aiInstructionsSchema, project.aiInstructions);
  const values = form.watch();
  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate>
      <SettingsSection
        title="AI instructions"
        description="Like a CLAUDE.md file for this project. Every AI app and AI worker working here gets these with each answer from MSR, so they follow your rules on every task."
        footer={
          <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
            Save instructions
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {FIELDS.map((field) => (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={`ai-${field.name}`}
              hint={`${field.hint} ${values[field.name]?.length ?? 0} / ${AI_INSTRUCTIONS_MAX}`}
              error={errors[field.name]?.message}
            >
              <Textarea
                id={`ai-${field.name}`}
                rows={5}
                maxLength={AI_INSTRUCTIONS_MAX}
                placeholder={field.placeholder}
                {...form.register(field.name)}
              />
            </Field>
          ))}
        </div>
      </SettingsSection>
    </form>
  );
}
