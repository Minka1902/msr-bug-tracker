import { PLAN_META, planAllows, type ProjectModule } from '@msr/shared/modules';
import type { ShopState } from '@msr/shared/types';

export type ModuleAccess = 'plan' | 'pack' | 'locked';

export const packLeft = (shop: ShopState, module: ProjectModule) =>
  shop.packs.find((pack) => pack.module === module)?.projectsLeft ?? 0;

export const planHasRoom = (shop: ShopState) =>
  shop.plan.projectsUsed < PLAN_META[shop.plan.tier].projectsPerYear;

export const moduleAccess = (shop: ShopState, module: ProjectModule): ModuleAccess =>
  planAllows(shop.plan.tier, module) && planHasRoom(shop)
    ? 'plan'
    : packLeft(shop, module) > 0
      ? 'pack'
      : 'locked';
