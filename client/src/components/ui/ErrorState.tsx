import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface ErrorStateProps {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', error, onRetry, compact, className }: ErrorStateProps) {
  return (
    <EmptyState
      compact={compact}
      className={className}
      icon={<TriangleAlert />}
      title={title}
      description={error instanceof Error ? error.message : undefined}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" leftIcon={<RotateCw />} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
