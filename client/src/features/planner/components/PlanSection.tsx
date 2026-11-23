import type { ReactNode } from 'react';

interface PlanSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function PlanSection({ title, icon, children }: PlanSectionProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}
