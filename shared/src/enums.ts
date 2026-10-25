export const TASK_TYPES = ['task', 'bug', 'feature', 'improvement'] as const;
export const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export const SEVERITIES = ['critical', 'major', 'minor', 'trivial'] as const;
export const REPRODUCIBILITY = ['always', 'sometimes', 'rarely'] as const;
export const STATUS_CATEGORIES = ['backlog', 'todo', 'in_progress', 'done'] as const;
export const WORKFLOWS = ['task', 'bug'] as const;
export const RELATION_TYPES = ['relates', 'duplicates'] as const;
export const THEME_STYLES = ['aurora', 'clean'] as const;
export const THEME_MODES = ['light', 'dark', 'system'] as const;
export const NAV_LAYOUTS = ['sidebar', 'rail'] as const;
export const AI_PROVIDERS = ['anthropic', 'openai', 'google', 'xai'] as const;

export type TaskType = (typeof TASK_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Reproducibility = (typeof REPRODUCIBILITY)[number];
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export type Workflow = (typeof WORKFLOWS)[number];
export type RelationType = (typeof RELATION_TYPES)[number];
export type ThemeStyle = (typeof THEME_STYLES)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type NavLayout = (typeof NAV_LAYOUTS)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

export interface EnumMeta {
  label: string;
  tone: Tone;
}

export const TYPE_META: Record<TaskType, EnumMeta> = {
  task: { label: 'Task', tone: 'info' },
  bug: { label: 'Bug', tone: 'danger' },
  feature: { label: 'Feature', tone: 'violet' },
  improvement: { label: 'Improvement', tone: 'success' },
};

export const PRIORITY_META: Record<Priority, EnumMeta> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  medium: { label: 'Medium', tone: 'accent' },
  low: { label: 'Low', tone: 'neutral' },
};

export const SEVERITY_META: Record<Severity, EnumMeta> = {
  critical: { label: 'Critical', tone: 'danger' },
  major: { label: 'Major', tone: 'warning' },
  minor: { label: 'Minor', tone: 'info' },
  trivial: { label: 'Trivial', tone: 'neutral' },
};

export const REPRODUCIBILITY_META: Record<Reproducibility, EnumMeta> = {
  always: { label: 'Always', tone: 'danger' },
  sometimes: { label: 'Sometimes', tone: 'warning' },
  rarely: { label: 'Rarely', tone: 'neutral' },
};

export const STATUS_CATEGORY_META: Record<StatusCategory, EnumMeta> = {
  backlog: { label: 'Backlog', tone: 'neutral' },
  todo: { label: 'To do', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'accent' },
  done: { label: 'Done', tone: 'success' },
};

export const WORKFLOW_META: Record<Workflow, EnumMeta> = {
  task: { label: 'Tasks', tone: 'info' },
  bug: { label: 'Bugs', tone: 'danger' },
};

export const RELATION_META: Record<RelationType, EnumMeta> = {
  relates: { label: 'Relates to', tone: 'neutral' },
  duplicates: { label: 'Duplicates', tone: 'warning' },
};

export const AI_PROVIDER_META: Record<AiProvider, { label: string; vendor: string; keysUrl: string }> = {
  anthropic: { label: 'Claude', vendor: 'Anthropic', keysUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'ChatGPT', vendor: 'OpenAI', keysUrl: 'https://platform.openai.com/api-keys' },
  google: { label: 'Gemini', vendor: 'Google', keysUrl: 'https://aistudio.google.com/app/apikey' },
  xai: { label: 'Grok', vendor: 'xAI', keysUrl: 'https://console.x.ai' },
};

export const LABEL_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#14b8a6',
  '#64748b',
];

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const DEFAULT_STATUSES: Record<Workflow, { name: string; color: string; category: StatusCategory }[]> =
  {
    task: [
      { name: 'Backlog', color: '#94a3b8', category: 'backlog' },
      { name: 'To Do', color: '#64748b', category: 'todo' },
      { name: 'In Progress', color: '#3b82f6', category: 'in_progress' },
      { name: 'In Review', color: '#d946ef', category: 'in_progress' },
      { name: 'Done', color: '#22c55e', category: 'done' },
    ],
    bug: [
      { name: 'Open', color: '#ef4444', category: 'todo' },
      { name: 'In Progress', color: '#3b82f6', category: 'in_progress' },
      { name: 'Ready for QA', color: '#f59e0b', category: 'in_progress' },
      { name: 'Resolved', color: '#22c55e', category: 'done' },
      { name: 'Closed', color: '#64748b', category: 'done' },
    ],
  };

export const workflowOf = (type: TaskType): Workflow => (type === 'bug' ? 'bug' : 'task');
