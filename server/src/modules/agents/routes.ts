import { Router } from 'express';
import { createAgentSchema, updateAgentSchema } from '@msr/shared/schemas/agents';
import { uuidSchema } from '@msr/shared/schemas/project';
import { forbidden } from '../../lib/httpError';
import { createWorker, deleteWorker, listWorkers, updateWorker } from './service';

export const createAgentsRouter = () => {
  const router = Router();

  router.use((req, _res, next) => {
    if (req.method !== 'GET' && req.user!.impersonator)
      throw forbidden("You can't manage AI workers while viewing as someone else");
    next();
  });

  router.get('/', async (req, res) => {
    res.json({ workers: await listWorkers(req.user!.id) });
  });

  router.post('/', async (req, res) => {
    const { grantId, name } = createAgentSchema.parse(req.body);
    await createWorker(req.user!.id, grantId, name);
    res.status(201).json({ workers: await listWorkers(req.user!.id) });
  });

  router.patch('/:id', async (req, res) => {
    await updateWorker(req.user!.id, uuidSchema.parse(req.params.id), updateAgentSchema.parse(req.body));
    res.json({ workers: await listWorkers(req.user!.id) });
  });

  router.delete('/:id', async (req, res) => {
    await deleteWorker(req.user!.id, uuidSchema.parse(req.params.id));
    res.status(204).end();
  });

  return router;
};
