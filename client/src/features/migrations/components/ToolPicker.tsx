import { ArrowRight, FileSpreadsheet, Workflow } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { MIGRATION_TOOLS, type MigrationTool } from '../tools';

interface ToolPickerProps {
  onPick: (tool: MigrationTool) => void;
  onPickFile: () => void;
}

const CARD =
  'group flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40';

export function ToolPicker({ onPick, onPickFile }: ToolPickerProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MIGRATION_TOOLS.map((tool) => (
        <button key={tool.id} type="button" className={CARD} onClick={() => onPick(tool)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control tint text-accent-text [--c:var(--c-accent)]">
            <Workflow className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{tool.label}</span>
            <span className="block text-xs text-muted">{tool.description}</span>
          </span>
          <ArrowRight className="mt-1 size-4 text-subtle transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
      <button type="button" className={cn(CARD, 'sm:col-span-2')} onClick={onPickFile}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control tint text-accent-text [--c:var(--c-success)]">
          <FileSpreadsheet className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">CSV or Excel file</span>
          <span className="block text-xs text-muted">
            Any other tool: export to CSV or Excel, or fill in our template, and import it into a project.
          </span>
        </span>
        <ArrowRight className="mt-1 size-4 text-subtle transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
