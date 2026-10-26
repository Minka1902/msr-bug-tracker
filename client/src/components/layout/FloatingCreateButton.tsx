import { Plus } from 'lucide-react';
import { useMatch } from 'react-router';
import { cn } from '../../lib/cn';
import type { ShellActions, ShellProject } from './shellTypes';

interface FloatingCreateButtonProps {
  projects: ShellProject[];
  onCreate: ShellActions['onQuickCreate'];
  className?: string;
}

export function FloatingCreateButton({ projects, onCreate, className }: FloatingCreateButtonProps) {
  const match = useMatch('/p/:key/*');
  const project = projects.find((item) => item.key === match?.params.key?.toUpperCase());
  const household = project?.kind === 'household';

  return (
    <button
      type="button"
      aria-label={project ? `New ${household ? 'chore' : 'task'} in ${project.name}` : 'New task'}
      onClick={() => onCreate(project && { projectKey: project.key, ...(household && { type: 'chore' }) })}
      className={cn(
        'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[0_12px_28px_-10px_var(--c-accent)] transition-transform active:scale-95 lefty:right-auto lefty:left-4 [&_svg]:size-6',
        className,
      )}
    >
      <Plus />
    </button>
  );
}
