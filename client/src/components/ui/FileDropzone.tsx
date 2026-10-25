import { Upload } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  disabled,
  loading,
  hint = 'Drop files or click to upload',
  className,
  children,
}: FileDropzoneProps) {
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled && event.dataTransfer.files.length) onFiles([...event.dataTransfer.files]);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => event.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-border-strong px-4 py-5 text-center text-sm text-muted transition-colors hover:border-accent hover:text-text aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        over && 'border-accent bg-accent-soft text-text',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          if (event.target.files?.length) onFiles([...event.target.files]);
          event.target.value = '';
        }}
      />
      {loading ? <Spinner className="size-5" /> : <Upload className="size-5" />}
      {children ?? hint}
    </div>
  );
}
