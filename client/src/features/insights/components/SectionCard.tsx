import { useId, type ReactNode } from 'react';
import { Card, type CardProps } from '../../../components/ui/Card';
import { cn } from '../../../lib/cn';

interface SectionCardProps extends Omit<CardProps, 'title'> {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function SectionCard({ title, icon, action, children, className, ...props }: SectionCardProps) {
  const headingId = useId();

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      className={cn('flex flex-col gap-3', className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
        <h2 id={headingId} className="flex-1 text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}
