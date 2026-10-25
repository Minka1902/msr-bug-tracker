import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const labelId = useId();
  const grouped = label && !htmlFor;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label id={labelId} htmlFor={htmlFor} className="text-sm font-medium text-text">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {grouped ? (
        <div role="group" aria-labelledby={labelId} className="contents">
          {children}
        </div>
      ) : (
        children
      )}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
