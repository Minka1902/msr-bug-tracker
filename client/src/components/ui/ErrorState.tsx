import { RotateCw, TriangleAlert, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { isNetworkError } from '../../lib/api';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface ErrorStateProps {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorState({ title, error, onRetry, compact, className }: ErrorStateProps) {
  const offline = isNetworkError(error);

  useEffect(() => {
    if (!offline || !onRetry) return;
    const retry = () => onRetry();
    addEventListener('online', retry);
    return () => removeEventListener('online', retry);
  }, [offline, onRetry]);

  return (
    <EmptyState
      compact={compact}
      className={className}
      icon={offline ? <WifiOff /> : <TriangleAlert />}
      title={title ?? (offline ? "You're offline" : 'Something went wrong')}
      description={
        offline
          ? "Check your connection. We'll reload automatically when you're back online."
          : error instanceof Error
            ? error.message
            : undefined
      }
      action={
        onRetry && (
          <Button variant="secondary" size="sm" leftIcon={<RotateCw />} onClick={() => onRetry()}>
            Try again
          </Button>
        )
      }
    />
  );
}
