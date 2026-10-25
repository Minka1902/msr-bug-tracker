import type { ReactNode } from 'react';
import { Card } from '../../../components/ui/Card';

interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function SettingsSection({ title, description, children, footer }: SettingsSectionProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:gap-8">
        <div className="md:w-64 md:shrink-0">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/50 px-5 py-3">
          {footer}
        </div>
      )}
    </Card>
  );
}
