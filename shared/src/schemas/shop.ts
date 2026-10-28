import { z } from 'zod';
import { PACK_MAX, PAID_TIERS, PROJECT_MODULES } from '../modules';

export const subscribeSchema = z.object({ tier: z.enum(PAID_TIERS) });
export const packSchema = z.object({
  module: z.enum(PROJECT_MODULES),
  projects: z
    .int()
    .min(1, 'Buy at least 1 project')
    .max(PACK_MAX, `Buy at most ${PACK_MAX} projects at once`),
});

export type PackInput = z.infer<typeof packSchema>;
