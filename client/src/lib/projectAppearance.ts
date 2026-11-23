import type { LucideIcon } from 'lucide-react';
import { PROJECT_ICON_CATEGORIES } from './projectIcons';

export const PROJECT_ICONS: Record<string, LucideIcon> = Object.assign(
  {},
  ...PROJECT_ICON_CATEGORIES.map((category) => category.icons),
);

export const PROJECT_COLORS = [
  '#4f56f0',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#64748b',
];

export const FLAG_COLORS = [...PROJECT_COLORS, '#ffffff', '#0f172a'];
