import type { ReactNode } from 'react';

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
