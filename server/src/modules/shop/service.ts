import {
  MODULE_META,
  PLAN_META,
  PLAN_TIERS,
  minimumPlan,
  planAllows,
  type PaidTier,
  type PlanTier,
  type ProjectModule,
} from '@msr/shared/modules';
import type { PackInput } from '@msr/shared/schemas/shop';
import type { PackBalance, ShopState } from '@msr/shared/types';
import { query, queryOne, type Db } from '../../db/pool';
import { conflict, paymentRequired } from '../../lib/httpError';

interface PlanRow {
  tier: PaidTier | null;
  starts_at: Date;
  expires_at: Date | null;
  used: number;
}

export const activeSubscription = (userId: string) => `
  SELECT tier, starts_at, expires_at FROM subscriptions
  WHERE user_id = ${userId} AND expires_at > now()
  ORDER BY tier DESC, expires_at DESC LIMIT 1`;

const CURRENT_PLAN = `
  SELECT s.tier, coalesce(s.starts_at, now() - interval '1 year') AS starts_at, s.expires_at,
         (SELECT count(*)::int FROM project_creations c
          WHERE c.user_id = $1 AND c.pack_id IS NULL
            AND c.created_at >= coalesce(s.starts_at, now() - interval '1 year')) AS used
  FROM (SELECT 1) AS one
  LEFT JOIN LATERAL (${activeSubscription('$1')}) s ON true`;
const OPEN_PACKS = `
  SELECT module, sum(projects - projects_used)::int AS projects_left FROM module_packs
  WHERE user_id = $1 AND projects_used < projects GROUP BY module ORDER BY module`;
const LOCK_USER = 'SELECT 1 FROM users WHERE id = $1 FOR UPDATE';
const CLAIM_PACK = `
  UPDATE module_packs SET projects_used = projects_used + 1
  WHERE id = (SELECT id FROM module_packs WHERE user_id = $1 AND module = $2 AND projects_used < projects
              ORDER BY created_at LIMIT 1)
  RETURNING id`;
const RECORD_CREATION = 'INSERT INTO project_creations (user_id, project_id, pack_id) VALUES ($1, $2, $3)';
const SUBSCRIBE = `
  INSERT INTO subscriptions (user_id, tier, price_cents, expires_at) VALUES ($1, $2, $3, now() + interval '1 year')`;
const INSERT_PACK =
  'INSERT INTO module_packs (user_id, module, projects, price_cents) VALUES ($1, $2, $3, $4)';

export const currentPlan = async (userId: string, db?: Db) => {
  const row = (await queryOne<PlanRow>(CURRENT_PLAN, [userId], db))!;
  const tier: PlanTier = row.tier ?? 'free';
  return { tier, startsAt: row.starts_at, expiresAt: row.expires_at, used: row.used };
};

export const getShop = async (userId: string): Promise<ShopState> => {
  const [plan, packs] = await Promise.all([
    currentPlan(userId),
    query<{ module: ProjectModule; projects_left: number }>(OPEN_PACKS, [userId]),
  ]);
  return {
    plan: {
      tier: plan.tier,
      startsAt: plan.tier === 'free' ? null : plan.startsAt.toISOString(),
      expiresAt: plan.expiresAt?.toISOString() ?? null,
      projectsUsed: plan.used,
      projectsLimit: PLAN_META[plan.tier].projectsPerYear,
    },
    packs: packs.map((row): PackBalance => ({ module: row.module, projectsLeft: row.projects_left })),
  };
};

export const claimProjectSlot = async (userId: string, module: ProjectModule, db: Db) => {
  await query(LOCK_USER, [userId], db);
  const plan = await currentPlan(userId, db);
  const allowed = planAllows(plan.tier, module);
  if (allowed && plan.used < PLAN_META[plan.tier].projectsPerYear) return null;
  const pack = await queryOne<{ id: string }>(CLAIM_PACK, [userId, module], db);
  if (pack) return pack.id;
  const name = MODULE_META[module].label;
  throw paymentRequired(
    allowed
      ? `Your ${PLAN_META[plan.tier].label} plan allows ${PLAN_META[plan.tier].projectsPerYear} new projects a year — buy a ${name} pack for more`
      : `Upgrade to ${PLAN_META[minimumPlan(module)].label} or buy ${name} projects to start one`,
  );
};

export const recordCreation = (userId: string, projectId: string, packId: string | null, db: Db) =>
  query(RECORD_CREATION, [userId, projectId, packId], db);

export const subscribe = async (userId: string, tier: PaidTier) => {
  const plan = await currentPlan(userId);
  if (PLAN_TIERS.indexOf(plan.tier) >= PLAN_TIERS.indexOf(tier))
    throw conflict(`You already have ${PLAN_META[plan.tier].label}`);
  await query(SUBSCRIBE, [userId, tier, PLAN_META[tier].priceCents]);
};

export const buyPack = (userId: string, input: PackInput) =>
  query(INSERT_PACK, [userId, input.module, input.projects, 0]);
