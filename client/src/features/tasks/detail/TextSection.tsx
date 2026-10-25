import { useId, type ReactNode } from 'react';

interface TextSectionProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function TextSection({ title, icon, action, children }: TextSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
        <h3 id={headingId} className="flex-1 text-sm font-semibold">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
