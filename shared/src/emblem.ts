export const EMBLEM_SHAPES = ['rounded', 'circle', 'squircle', 'hexagon', 'shield', 'swallowtail'] as const;
export const EMBLEM_PATTERNS = [
  'solid',
  'stripes-2',
  'stripes-3',
  'bars-2',
  'bars-3',
  'diagonal',
  'quarters',
  'cross',
  'nordic',
  'chevron',
  'disc',
  'frame',
] as const;
export const DIVIDER_WIDTHS = [0, 1, 2, 3] as const;

export type EmblemShape = (typeof EMBLEM_SHAPES)[number];
export type EmblemPattern = (typeof EMBLEM_PATTERNS)[number];
export type DividerWidth = (typeof DIVIDER_WIDTHS)[number];

export interface Emblem {
  shape: EmblemShape;
  pattern: EmblemPattern;
  colors: string[];
  divider: { color: string; width: DividerWidth };
  iconColor: string;
  showIcon: boolean;
}

export const PATTERN_PARTS: Record<EmblemPattern, number> = {
  solid: 1,
  'stripes-2': 2,
  'stripes-3': 3,
  'bars-2': 2,
  'bars-3': 3,
  diagonal: 2,
  quarters: 4,
  cross: 2,
  nordic: 2,
  chevron: 3,
  disc: 2,
  frame: 2,
};

const FILL_COLORS = ['#ffffff', '#0f172a', '#f59e0b'];

export const fitColors = (colors: string[], pattern: EmblemPattern) =>
  Array.from(
    { length: PATTERN_PARTS[pattern] },
    (_, index) => colors[index] ?? FILL_COLORS[(index - colors.length) % FILL_COLORS.length]!,
  );

export const defaultEmblem = (color: string): Emblem => ({
  shape: 'rounded',
  pattern: 'stripes-3',
  colors: [color, '#ffffff', color],
  divider: { color: '#0f172a', width: 0 },
  iconColor: '#0f172a',
  showIcon: true,
});
