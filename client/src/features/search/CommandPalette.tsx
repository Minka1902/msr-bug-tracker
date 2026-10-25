import { Command } from 'cmdk';
import {
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Monitor,
  Moon,
  PanelLeft,
  PanelsLeftBottom,
  Plus,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { KeyHint } from '../../components/ui/KeyHint';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { Spinner } from '../../components/ui/Spinner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTheme } from '../../hooks/useTheme';
import { useProjects } from '../projects/api';
import { useSearch } from '../insights/api';
import { PriorityIcon, TypeIcon } from '../tasks/taskMeta';
import { useTaskPeek } from '../tasks/useTaskPeek';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: () => void;
  onCreateProject: () => void;
  onLogout: () => void;
}

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

const itemClass =
  'flex min-h-10 cursor-pointer items-center gap-3 rounded-control px-3 py-1.5 text-sm outline-none data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-text [&_svg]:size-4 [&_svg]:shrink-0';
const groupClass =
  'px-2 pb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle [&_[cmdk-group-heading]]:uppercase';

const matches = (query: string, ...values: (string | undefined)[]) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = values.join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
};

const group = (heading: string, children: ReactNode) => (
  <Command.Group heading={heading} className={groupClass}>
    {children}
  </Command.Group>
);

export function CommandPalette({
  open,
  onOpenChange,
  onCreateTask,
  onCreateProject,
  onLogout,
}: CommandPaletteProps) {
  const run = (action: () => void) => {
    onOpenChange(false);
    setQuery('');
    action();
  };

  const navigate = useNavigate();
  const peek = useTaskPeek();
  const { setTheme } = useTheme();
  const projects = useProjects('all');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 150);
  const search = useSearch(debounced);

  const actions: PaletteAction[] = [
    { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, run: () => navigate('/') },
    { id: 'my-tasks', label: 'Go to My Tasks', icon: ListTodo, run: () => navigate('/my-tasks') },
    { id: 'projects', label: 'Go to Projects', icon: FolderKanban, run: () => navigate('/projects') },
    { id: 'settings', label: 'Open Settings', icon: Settings, run: () => navigate('/settings') },
    { id: 'new-task', label: 'Create task', icon: Plus, keywords: 'new add bug', run: onCreateTask },
    {
      id: 'new-project',
      label: 'Create project',
      icon: FolderPlus,
      keywords: 'new add',
      run: onCreateProject,
    },
    {
      id: 'light',
      label: 'Switch to light mode',
      icon: Sun,
      keywords: 'theme appearance',
      run: () => setTheme({ mode: 'light' }),
    },
    {
      id: 'dark',
      label: 'Switch to dark mode',
      icon: Moon,
      keywords: 'theme appearance',
      run: () => setTheme({ mode: 'dark' }),
    },
    {
      id: 'system',
      label: 'Use system theme',
      icon: Monitor,
      keywords: 'theme appearance mode',
      run: () => setTheme({ mode: 'system' }),
    },
    {
      id: 'aurora',
      label: 'Use Aurora style',
      icon: Sparkles,
      keywords: 'theme style',
      run: () => setTheme({ style: 'aurora' }),
    },
    {
      id: 'clean',
      label: 'Use Clean style',
      icon: Square,
      keywords: 'theme style',
      run: () => setTheme({ style: 'clean' }),
    },
    {
      id: 'sidebar',
      label: 'Use sidebar navigation',
      icon: PanelLeft,
      keywords: 'layout nav',
      run: () => setTheme({ nav: 'sidebar' }),
    },
    {
      id: 'rail',
      label: 'Use icon rail navigation',
      icon: PanelsLeftBottom,
      keywords: 'layout nav',
      run: () => setTheme({ nav: 'rail' }),
    },
    { id: 'logout', label: 'Log out', icon: LogOut, keywords: 'sign out', run: onLogout },
  ];
  const visibleActions = actions.filter((action) => !query || matches(query, action.label, action.keywords));
  const visibleProjects = (projects.data ?? [])
    .filter((project) => !query || matches(query, project.name, project.key))
    .slice(0, query ? 6 : 5);
  const tasks = query.trim() ? (search.data?.tasks ?? []) : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-[12dvh] left-1/2 z-50 w-[calc(100vw-24px)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface-raised shadow-pop outline-none max-md:top-[calc(env(safe-area-inset-top)+12px)]">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search tasks and projects or run a command
          </Dialog.Description>
          <Command shouldFilter={false} loop label="Command palette">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-subtle" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search tasks, projects or type a command…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
              />
              {search.isFetching && <Spinner className="text-subtle" />}
              <KeyHint keys={['Esc']} />
            </div>
            <Command.List className="max-h-[min(60dvh,520px)] overflow-y-auto scrollbar-thin">
              <Command.Empty className="px-4 py-10 text-center text-sm text-muted">
                {search.isFetching ? 'Searching…' : `No results for “${query}”`}
              </Command.Empty>
              {tasks.length > 0 &&
                group(
                  'Tasks',
                  tasks.map((task) => (
                    <Command.Item
                      key={task.id}
                      value={`task-${task.id}`}
                      onSelect={() => run(() => peek.open(task.identifier))}
                      className={itemClass}
                    >
                      <TypeIcon type={task.type} />
                      <span className="font-mono text-xs text-subtle">{task.identifier}</span>
                      <span
                        className={`flex-1 truncate ${task.statusCategory === 'done' ? 'text-muted line-through' : ''}`}
                      >
                        {task.title}
                      </span>
                      <PriorityIcon priority={task.priority} />
                    </Command.Item>
                  )),
                )}
              {visibleProjects.length > 0 &&
                group(
                  'Projects',
                  visibleProjects.map((project) => (
                    <Command.Item
                      key={project.key}
                      value={`project-${project.key}`}
                      onSelect={() => run(() => navigate(`/p/${project.key}`))}
                      className={itemClass}
                    >
                      <ProjectAvatar color={project.color} icon={project.icon} size="xs" />
                      <span className="flex-1 truncate">{project.name}</span>
                      <span className="font-mono text-xs text-subtle">{project.key}</span>
                    </Command.Item>
                  )),
                )}
              {visibleActions.length > 0 &&
                group(
                  'Commands',
                  visibleActions.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={`action-${action.id}`}
                      onSelect={() => run(action.run)}
                      className={itemClass}
                    >
                      <action.icon />
                      <span className="flex-1">{action.label}</span>
                    </Command.Item>
                  )),
                )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
