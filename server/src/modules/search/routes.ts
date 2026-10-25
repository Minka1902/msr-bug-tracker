import { Router } from 'express';
import { z } from 'zod';
import { search } from './service';

const searchQuerySchema = z.object({ q: z.string().max(200).default('') });

export const createSearchRouter = () => {
  const router = Router();

  router.get('/search', async (req, res) => {
    res.json(await search(req.user!.id, searchQuerySchema.parse(req.query).q));
  });

  return router;
};
