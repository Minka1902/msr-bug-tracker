import { Router } from 'express';
import { packSchema, subscribeSchema } from '@msr/shared/schemas/shop';
import type { RateLimits } from '../../middleware/rateLimits';
import { buyPack, getShop, subscribe } from './service';

export const createShopRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await getShop(req.user!.id));
  });

  router.post('/subscribe', limits.shop, async (req, res) => {
    await subscribe(req.user!.id, subscribeSchema.parse(req.body).tier);
    res.status(201).json(await getShop(req.user!.id));
  });

  router.post('/packs', limits.shop, async (req, res) => {
    await buyPack(req.user!.id, packSchema.parse(req.body));
    res.status(201).json(await getShop(req.user!.id));
  });

  return router;
};
