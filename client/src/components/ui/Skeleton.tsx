import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      aria-hidden
      className={cn('animate-pulse rounded-control bg-surface-muted', className)}
    />
  ));
}
