import { Hexagon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LogoProps {
  compact?: boolean;
  className?: string;
}

export function Logo({ compact, className }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#38bdf8,var(--c-accent))] text-white shadow-[0_6px_16px_-6px_var(--c-accent)] clean:bg-none clean:text-accent-text clean:shadow-none">
        <Hexagon className="size-5" strokeWidth={2.5} />
      </span>
      {!compact && <span className="font-display text-[15px] font-extrabold tracking-wide uppercase">MSR Tracker</span>}
    </span>
  );
}
