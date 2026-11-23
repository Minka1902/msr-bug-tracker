import { MODULE_META, PROJECT_MODULES } from '@msr/shared/modules';
import { describe, expect, it } from 'vitest';
import { PROJECT_ICONS } from '../projectAppearance';
import { PROJECT_ICON_CATEGORIES } from '../projectIcons';

const SAVED_ICONS = [
  'hexagon',
  'house',
  'rocket',
  'globe',
  'smartphone',
  'app-window',
  'code',
  'server',
  'database',
  'cloud',
  'cpu',
  'bot',
  'bug',
  'wrench',
  'layers',
  'box',
  'package',
  'credit-card',
  'shopping-cart',
  'chart-line',
  'target',
  'megaphone',
  'mail',
  'lock',
  'palette',
  'brush',
  'camera',
  'music',
  'gamepad-2',
  'lightbulb',
  'sparkles',
  'star',
  'heart',
  'flame',
  'leaf',
  'coffee',
  'map',
  'plane',
  'bike',
  'building-2',
  'graduation-cap',
];

describe('project icon categories', () => {
  it('keeps every icon a project may already have saved', () => {
    for (const name of SAVED_ICONS) expect(PROJECT_ICONS[name], name).toBeDefined();
  });

  it('includes every module icon', () => {
    for (const module of PROJECT_MODULES) expect(PROJECT_ICONS[MODULE_META[module].icon]).toBeDefined();
  });

  it('lists each icon in exactly one category', () => {
    const names = PROJECT_ICON_CATEGORIES.flatMap((category) => Object.keys(category.icons));
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(PROJECT_ICONS)).toHaveLength(names.length);
  });

  it('offers at least 12 categories of at least 12 icons each', () => {
    expect(PROJECT_ICON_CATEGORIES.length).toBeGreaterThanOrEqual(12);
    for (const category of PROJECT_ICON_CATEGORIES)
      expect(Object.keys(category.icons).length, category.label).toBeGreaterThanOrEqual(12);
  });

  it('uses names the server accepts', () => {
    for (const name of Object.keys(PROJECT_ICONS)) expect(name).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
