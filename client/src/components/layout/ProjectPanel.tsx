import { ChevronsLeft } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { ProjectNavList } from './ProjectNavList';
import type { ShellProject } from './shellTypes';

interface ProjectPanelProps {
  projects: ShellProject[];
  onCreateProject: () => void;
  onCollapse: () => void;
}

export function ProjectPanel({ projects, onCreateProject, onCollapse }: ProjectPanelProps) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface-muted/60 aurora:bg-surface-glass/40">
      <div className="flex h-16 items-center gap-2 px-4">
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="flex-1 text-sm font-semibold tracking-wide uppercase">Projects</span>
        <IconButton
          icon={<ChevronsLeft />}
          label="Hide projects"
          onClick={onCollapse}
          className="rounded-full border border-accent/40 text-accent-text"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
        <ProjectNavList projects={projects} onCreateProject={onCreateProject} limit={100} />
      </div>
    </aside>
  );
}
