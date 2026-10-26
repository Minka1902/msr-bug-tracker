import { CircleAlert, ExternalLink, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Banner } from '../../../components/ui/Banner';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { errorMessage } from '../../../lib/api';
import { PasswordInput } from '../../auth/components/PasswordInput';
import type { MigrationTool } from '../tools';

interface CredentialsStepProps {
  tool: MigrationTool;
  formId: string;
  error: unknown;
  onSubmit: (credentials: Record<string, string>) => void;
}

export function CredentialsStep({ tool, formId, error, onSubmit }: CredentialsStepProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!!error && (
        <Banner tone="danger" icon={<CircleAlert />}>
          {errorMessage(error)}
        </Banner>
      )}
      <p className="text-sm text-muted">
        {tool.help}{' '}
        <a
          href={tool.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline"
        >
          Open {tool.label} <ExternalLink className="size-3" />
        </a>
      </p>
      {tool.fields.map((field, index) => {
        const id = `migration-${tool.id}-${field.name}`;
        const props = {
          id,
          autoFocus: index === 0,
          autoComplete: 'off',
          spellCheck: false,
          placeholder: field.placeholder,
          value: values[field.name] ?? '',
          onChange: (event: { target: { value: string } }) =>
            setValues((current) => ({ ...current, [field.name]: event.target.value })),
        };
        return (
          <Field key={field.name} label={field.label} htmlFor={id}>
            {field.type === 'password' ? (
              <PasswordInput {...props} />
            ) : (
              <Input type={field.type} {...props} />
            )}
          </Field>
        );
      })}
      <Banner tone="info" icon={<ShieldCheck />}>
        We use these details only while this import runs. They are never saved.
      </Banner>
    </form>
  );
}
