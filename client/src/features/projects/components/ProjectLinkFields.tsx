import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';

interface ProjectLinkFieldsProps {
  liveUrl: UseFormRegisterReturn;
  repoUrl: UseFormRegisterReturn;
  errors?: { liveUrl?: string; repoUrl?: string };
  idPrefix?: string;
}

const FIELDS = [
  { name: 'liveUrl', label: 'Live URL', placeholder: 'https://app.example.com' },
  { name: 'repoUrl', label: 'Repository URL', placeholder: 'https://github.com/team/repo' },
] as const;

export function ProjectLinkFields({
  liveUrl,
  repoUrl,
  errors,
  idPrefix = 'project',
}: ProjectLinkFieldsProps) {
  const registered = { liveUrl, repoUrl };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <Field
          key={field.name}
          label={field.label}
          htmlFor={`${idPrefix}-${field.name}`}
          error={errors?.[field.name]}
        >
          <Input
            id={`${idPrefix}-${field.name}`}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder={field.placeholder}
            invalid={!!errors?.[field.name]}
            {...registered[field.name]}
          />
        </Field>
      ))}
    </div>
  );
}
