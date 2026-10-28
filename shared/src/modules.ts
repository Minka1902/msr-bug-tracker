import { HOUSEHOLD_LABELS, workflowOf, type ProjectKind, type TaskType, type Workflow } from './enums';

export const PROJECT_MODULES = ['software', 'personal', 'household', 'skill', 'startup'] as const;
export const COMING_SOON_MODULES = ['event', 'renovation', 'job_search', 'trip', 'fitness'] as const;
export const PLAN_TIERS = ['free', 'personal', 'pro'] as const;
export const PAID_TIERS = ['personal', 'pro'] as const;
export const PACK_PRESETS = [10, 25] as const;
export const PACK_MAX = 100;

export type ProjectModule = (typeof PROJECT_MODULES)[number];
export type ComingSoonModule = (typeof COMING_SOON_MODULES)[number];
export type CatalogModule = ProjectModule | ComingSoonModule;
export type PlanTier = (typeof PLAN_TIERS)[number];
export type PaidTier = (typeof PAID_TIERS)[number];
export type BotAccess = 'none' | 'household' | 'all';

export interface ModuleMeta {
  label: string;
  description: string;
  icon: string;
  kind: ProjectKind;
  taskTypes: readonly TaskType[];
  labels: readonly string[];
  features: readonly string[];
  available: boolean;
}

export interface PlanMeta {
  label: string;
  description: string;
  modules: readonly CatalogModule[];
  bot: BotAccess;
  projectsPerYear: number;
  priceCents: number;
}

const SOFTWARE_TYPES: readonly TaskType[] = ['task', 'bug', 'feature', 'improvement'];
const STEP_TYPES: readonly TaskType[] = ['task', 'errand'];

export const MODULE_META: Record<CatalogModule, ModuleMeta> = {
  software: {
    label: 'Software',
    description: 'Tasks, bugs and features for a team',
    icon: 'hexagon',
    kind: 'software',
    taskTypes: SOFTWARE_TYPES,
    labels: [],
    features: [
      'Board, list and bug workflows',
      'Roles and permissions for your team',
      'Live site and repo links',
    ],
    available: true,
  },
  personal: {
    label: 'Personal project',
    description: 'Your own goals and side projects, one small step at a time',
    icon: 'target',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: ['Idea', 'Research', 'Do', 'Buy', 'Waiting'],
    features: [
      'AI breaks your goal into small steps',
      'Deadlines paced the way you like',
      'Steps the AI can do for you',
    ],
    available: true,
  },
  household: {
    label: 'Household',
    description: 'Chores, errands, shopping and a family calendar',
    icon: 'house',
    kind: 'household',
    taskTypes: ['chore', 'errand', 'task'],
    labels: HOUSEHOLD_LABELS,
    features: ['Chores with turn-taking', 'Shared shopping lists', 'Family calendar and appointments'],
    available: true,
  },
  skill: {
    label: 'Skill development',
    description: 'Learn something new with a practice plan',
    icon: 'graduation-cap',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: ['Practice', 'Theory', 'Project', 'Review'],
    features: [
      'AI builds a practice plan for your level',
      'Theory, practice and review steps',
      'Small daily sessions',
    ],
    available: true,
  },
  startup: {
    label: 'Startup idea',
    description: 'Take an idea from first step to first customers',
    icon: 'rocket',
    kind: 'software',
    taskTypes: SOFTWARE_TYPES,
    labels: ['Validation', 'Product', 'Marketing', 'Sales', 'Legal'],
    features: [
      'AI plans validation, product and launch',
      'Product work with bug tracking',
      'Work the AI can take on',
    ],
    available: true,
  },
  event: {
    label: 'Event',
    description: 'Weddings, birthdays and parties',
    icon: 'sparkles',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: [],
    features: ['Guests, venue and vendors', 'Budget and timeline'],
    available: false,
  },
  renovation: {
    label: 'Home renovation',
    description: 'Plan the work, the contractors and the budget',
    icon: 'wrench',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: [],
    features: ['Rooms, contractors and quotes', 'Budget and order of work'],
    available: false,
  },
  job_search: {
    label: 'Job search',
    description: 'Applications, interviews and follow-ups',
    icon: 'building-2',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: [],
    features: ['Track every application', 'Interview prep and follow-ups'],
    available: false,
  },
  trip: {
    label: 'Trip',
    description: 'Bookings, packing and day plans',
    icon: 'plane',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: [],
    features: ['Flights, stays and bookings', 'Packing lists and day plans'],
    available: false,
  },
  fitness: {
    label: 'Fitness',
    description: 'Training plans and healthy habits',
    icon: 'bike',
    kind: 'software',
    taskTypes: STEP_TYPES,
    labels: [],
    features: ['Training plan for your goal', 'Habits and progress'],
    available: false,
  },
};

export const BOT_META = {
  label: 'Telegram bot',
  description: 'Run a project from Telegram and get the updates you pick',
  icon: 'bot',
  features: [
    'Add to lists, create tasks and check what is due by chat',
    'Pick which updates each chat gets',
    'Appointment reminders and a daily digest',
  ],
} as const;

export const PLAN_META: Record<PlanTier, PlanMeta> = {
  free: {
    label: 'Free',
    description: 'Software and personal projects',
    modules: ['software', 'personal'],
    bot: 'none',
    projectsPerYear: 3,
    priceCents: 0,
  },
  personal: {
    label: 'Personal',
    description: 'Your home, your skills and your goals',
    modules: ['software', 'personal', 'household', 'skill', 'fitness', 'event', 'job_search'],
    bot: 'household',
    projectsPerYear: 150,
    priceCents: 0,
  },
  pro: {
    label: 'Pro',
    description: 'Every module, and the Telegram bot on any project',
    modules: [...PROJECT_MODULES, ...COMING_SOON_MODULES],
    bot: 'all',
    projectsPerYear: 350,
    priceCents: 0,
  },
};

export const isAvailable = (module: CatalogModule): module is ProjectModule => MODULE_META[module].available;

export const planAllows = (tier: PlanTier, module: CatalogModule) => PLAN_META[tier].modules.includes(module);

export const botAllowed = (tier: PlanTier, module: ProjectModule) =>
  PLAN_META[tier].bot === 'all' || (PLAN_META[tier].bot === 'household' && module === 'household');

export const minimumPlan = (module: CatalogModule) => PLAN_TIERS.find((tier) => planAllows(tier, module))!;

export const minimumBotPlan = (module: ProjectModule) => PLAN_TIERS.find((tier) => botAllowed(tier, module))!;

export const typesFor = (module: ProjectModule, workflow?: Workflow) =>
  MODULE_META[module].taskTypes.filter((type) => !workflow || workflowOf(type) === workflow);
