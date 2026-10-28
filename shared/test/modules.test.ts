import { describe, expect, it } from 'vitest';
import {
  COMING_SOON_MODULES,
  MODULE_META,
  PLAN_META,
  PLAN_TIERS,
  PROJECT_MODULES,
  botAllowed,
  minimumBotPlan,
  minimumPlan,
  planAllows,
  typesFor,
} from '../src/modules';
import { createProjectSchema } from '../src/schemas/project';
import { packSchema } from '../src/schemas/shop';

const CATALOG = [...PROJECT_MODULES, ...COMING_SOON_MODULES];

describe('module catalog', () => {
  it('has a unique id and an entry for every module', () => {
    expect(new Set(CATALOG).size).toBe(CATALOG.length);
    expect(Object.keys(MODULE_META).sort()).toEqual([...CATALOG].sort());
  });

  it('marks only the implemented modules as available', () => {
    expect(CATALOG.filter((module) => MODULE_META[module].available)).toEqual([...PROJECT_MODULES]);
  });

  it('only sells known modules, and each plan includes the one below', () => {
    for (const tier of PLAN_TIERS) expect(PLAN_META[tier].modules.every((module) => CATALOG.includes(module))).toBe(true);
    for (const [lower, higher] of [
      ['free', 'personal'],
      ['personal', 'pro'],
    ] as const)
      expect(PLAN_META[lower].modules.every((module) => PLAN_META[higher].modules.includes(module))).toBe(true);
    expect(PLAN_TIERS.map((tier) => PLAN_META[tier].projectsPerYear)).toEqual([3, 150, 350]);
  });

  it('knows which plan unlocks a module and the bot', () => {
    expect(planAllows('free', 'household')).toBe(false);
    expect(minimumPlan('household')).toBe('personal');
    expect(minimumPlan('startup')).toBe('pro');
    expect(minimumPlan('trip')).toBe('pro');
    expect(botAllowed('free', 'household')).toBe(false);
    expect(botAllowed('personal', 'household')).toBe(true);
    expect(botAllowed('personal', 'software')).toBe(false);
    expect(botAllowed('pro', 'software')).toBe(true);
    expect(minimumBotPlan('household')).toBe('personal');
    expect(minimumBotPlan('skill')).toBe('pro');
  });

  it('offers task types per module and workflow', () => {
    expect(typesFor('software', 'bug')).toEqual(['bug']);
    expect(typesFor('personal', 'bug')).toEqual([]);
    expect(typesFor('household')).toEqual(['chore', 'errand', 'task']);
  });

  it('creates software projects unless a module is given', () => {
    const base = { name: 'A', key: 'AB', color: '#112233', icon: 'hexagon' };
    expect(createProjectSchema.parse(base).module).toBe('software');
    expect(createProjectSchema.safeParse({ ...base, module: 'trip' }).success).toBe(false);
  });

  it('sells packs of 1 to 100 projects of an available module', () => {
    expect(packSchema.safeParse({ module: 'startup', projects: 10 }).success).toBe(true);
    expect(packSchema.safeParse({ module: 'startup', projects: 0 }).success).toBe(false);
    expect(packSchema.safeParse({ module: 'startup', projects: 101 }).success).toBe(false);
    expect(packSchema.safeParse({ module: 'fitness', projects: 10 }).success).toBe(false);
  });
});
