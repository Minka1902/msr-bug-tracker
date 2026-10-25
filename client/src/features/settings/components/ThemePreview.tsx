import type { NavLayout, ThemeStyle } from '@msr/shared/enums';
import { cn } from '../../../lib/cn';

interface ThemePreviewProps {
  style: ThemeStyle;
  mode: 'light' | 'dark';
  nav?: NavLayout;
  className?: string;
}

export function ThemePreview({ style, mode, nav = 'sidebar', className }: ThemePreviewProps) {
  return (
    <div
      data-style={style}
      data-mode={mode}
      aria-hidden
      className={cn('h-24 overflow-hidden rounded-[10px] bg-(image:--c-page) p-1.5', className)}
    >
      <div className="flex h-full overflow-hidden rounded-[calc(var(--r-card)*0.4)] bg-(--c-app)">
        {nav === 'rail' ? (
          <>
            <div className="flex w-4 flex-col items-center gap-1 border-r border-(--c-border) bg-(--c-surface) py-1.5">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="size-1.5 rounded-sm bg-(--c-text-subtle)" />
              ))}
            </div>
            <div className="flex w-10 flex-col gap-1 border-r border-(--c-border) p-1.5">
              <span className="h-1.5 rounded-sm bg-(--c-accent)" />
              <span className="h-1.5 rounded-sm bg-(--c-border-strong)" />
              <span className="h-1.5 rounded-sm bg-(--c-border-strong)" />
            </div>
          </>
        ) : (
          <div className="m-1 flex w-14 flex-col gap-1 rounded-[calc(var(--r-card)*0.3)] border border-(--c-border) bg-(--c-surface) p-1.5 shadow-(--sh-card)">
            <span className="h-1.5 rounded-sm bg-(--c-accent)" />
            <span className="h-1.5 w-3/4 rounded-sm bg-(--c-border-strong)" />
            <span className="h-1.5 w-2/3 rounded-sm bg-(--c-border-strong)" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5 p-1.5">
          <div className="flex items-center justify-between">
            <span className="h-2 w-12 rounded-sm bg-(--c-text)" />
            <span className="h-2.5 w-6 rounded-[3px] bg-(--c-accent)" />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1">
            {[0, 1, 2].map((card) => (
              <div
                key={card}
                className="flex flex-col gap-1 rounded-[calc(var(--r-card)*0.3)] border border-(--c-border) bg-(--c-surface) p-1 shadow-(--sh-card)"
              >
                <span className="h-1 w-3/4 rounded-sm bg-(--c-text-muted)" />
                <span className="mt-auto h-1 rounded-sm bg-(--c-accent-soft)" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
