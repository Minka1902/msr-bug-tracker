import { Router, type Request } from 'express';
import { z } from 'zod';
import { AI_PROVIDER_META, AI_PROVIDERS } from '@msr/shared/enums';
import { aiKeySchema } from '@msr/shared/schemas/auth';
import { badGateway, badRequest, forbidden } from '../../lib/httpError';
import type { RateLimits } from '../../middleware/rateLimits';
import { checkApiKey, deleteApiKey, listApiKeys, saveApiKey } from './service';

const providerSchema = z.enum(AI_PROVIDERS);

const ownProvider = (req: Request) => {
  if (req.user!.impersonator) throw forbidden('Switch back to your own account to manage API keys');
  return providerSchema.parse(req.params.provider);
};

export const createAiKeysRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json({ keys: await listApiKeys(req.user!.id) });
  });

  router.put('/:provider', limits.aiKeys, async (req, res) => {
    const provider = ownProvider(req);
    const { key } = aiKeySchema.parse(req.body);
    const { label, vendor } = AI_PROVIDER_META[provider];
    const check = await checkApiKey(provider, key);
    if (check === 'invalid') throw badRequest(`${vendor} rejected this ${label} key. Check that you copied all of it.`);
    if (check === 'unreachable') throw badGateway(`We couldn't reach ${vendor} to check the key. Try again shortly.`);
    await saveApiKey(req.user!.id, provider, key);
    res.json({ keys: await listApiKeys(req.user!.id) });
  });

  router.delete('/:provider', async (req, res) => {
    await deleteApiKey(req.user!.id, ownProvider(req));
    res.json({ keys: await listApiKeys(req.user!.id) });
  });

  return router;
};
