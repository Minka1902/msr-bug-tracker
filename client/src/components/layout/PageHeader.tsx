import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 pt-2 pb-5', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {icon}
        <div className="min-w-0 flex-[1_1_15rem]">
          <h1 className="truncate text-2xl font-bold md:text-[28px]">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
