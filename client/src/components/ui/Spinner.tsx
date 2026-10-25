import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return <LoaderCircle role="status" aria-label={label} className={cn('size-4 animate-spin', className)} />;
}
