import type { EmblemPattern, EmblemShape } from '@msr/shared/emblem';

export const DIVIDER_UNIT = 0.6;

export const SHAPE_PATHS: Record<EmblemShape, string> = {
  rounded:
    'M5.5 0h13A5.5 5.5 0 0 1 24 5.5v13a5.5 5.5 0 0 1-5.5 5.5h-13A5.5 5.5 0 0 1 0 18.5v-13A5.5 5.5 0 0 1 5.5 0Z',
  circle: 'M12 0a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z',
  squircle: 'M12 0C21.6 0 24 2.4 24 12s-2.4 12-12 12S0 21.6 0 12 2.4 0 12 0Z',
  hexagon: 'M12 0.4 22.3 6.2v11.6L12 23.6 1.7 17.8V6.2Z',
  shield: 'M12 0.5 22.5 4v8.3c0 5.6-4.4 9.8-10.5 11.2C5.9 22.1 1.5 17.9 1.5 12.3V4Z',
  swallowtail: 'M0 2.5h24l-5.5 9.5 5.5 9.5H0Z',
};

const FULL = 'M0 0h24v24H0Z';
const CROSS = 'M9 0h6v9h9v6h-9v9H9v-9H0V9h9Z';
const NORDIC = 'M6 0h4.5v9.75H24v4.5H10.5V24H6V14.25H0v-4.5h6Z';
const DISC = 'M12 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z';
const INNER = 'M4.5 4.5h15v15h-15Z';
const TRIANGLE = 'M0 0 11 12 0 24Z';

export const PATTERN_GEOMETRY: Record<EmblemPattern, { parts: string[]; dividers: string }> = {
  solid: { parts: [FULL], dividers: '' },
  'stripes-2': { parts: ['M0 0h24v12H0Z', 'M0 12h24v12H0Z'], dividers: 'M0 12H24' },
  'stripes-3': { parts: ['M0 0h24v8H0Z', 'M0 8h24v8H0Z', 'M0 16h24v8H0Z'], dividers: 'M0 8H24M0 16H24' },
  'bars-2': { parts: ['M0 0h12v24H0Z', 'M12 0h12v24H12Z'], dividers: 'M12 0V24' },
  'bars-3': { parts: ['M0 0h8v24H0Z', 'M8 0h8v24H8Z', 'M16 0h8v24H16Z'], dividers: 'M8 0V24M16 0V24' },
  diagonal: { parts: ['M0 0H24L0 24Z', 'M24 0V24H0Z'], dividers: 'M24 0 0 24' },
  quarters: {
    parts: ['M0 0h12v12H0Z', 'M12 0h12v12H12Z', 'M0 12h12v12H0Z', 'M12 12h12v12H12Z'],
    dividers: 'M12 0V24M0 12H24',
  },
  cross: { parts: [FULL, CROSS], dividers: CROSS },
  nordic: { parts: [FULL, NORDIC], dividers: NORDIC },
  chevron: {
    parts: ['M0 0h24v12H0Z', 'M0 12h24v12H0Z', TRIANGLE],
    dividers: `M11 12H24${TRIANGLE.slice(0, -1)}`,
  },
  disc: { parts: [FULL, DISC], dividers: DISC },
  frame: { parts: [FULL, INNER], dividers: INNER },
};

export const PART_NAMES: Record<EmblemPattern, string[]> = {
  solid: ['Background'],
  'stripes-2': ['Top', 'Bottom'],
  'stripes-3': ['Top', 'Middle', 'Bottom'],
  'bars-2': ['Left', 'Right'],
  'bars-3': ['Left', 'Middle', 'Right'],
  diagonal: ['Top left', 'Bottom right'],
  quarters: ['Top left', 'Top right', 'Bottom left', 'Bottom right'],
  cross: ['Field', 'Cross'],
  nordic: ['Field', 'Cross'],
  chevron: ['Top', 'Bottom', 'Triangle'],
  disc: ['Field', 'Disc'],
  frame: ['Border', 'Center'],
};

export const SHAPE_LABELS: Record<EmblemShape, string> = {
  rounded: 'Rounded square',
  circle: 'Circle',
  squircle: 'Squircle',
  hexagon: 'Hexagon',
  shield: 'Shield',
  swallowtail: 'Swallowtail flag',
};

export const PATTERN_LABELS: Record<EmblemPattern, string> = {
  solid: 'Solid',
  'stripes-2': 'Two stripes',
  'stripes-3': 'Three stripes',
  'bars-2': 'Two bars',
  'bars-3': 'Three bars',
  diagonal: 'Diagonal',
  quarters: 'Quarters',
  cross: 'Cross',
  nordic: 'Nordic cross',
  chevron: 'Chevron',
  disc: 'Disc',
  frame: 'Frame',
};
