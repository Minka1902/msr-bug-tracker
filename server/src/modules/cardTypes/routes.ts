import { Router } from 'express';
import { cardTypesAllowed } from '@msr/shared/modules';
import { cardTypeSchema, updateCardTypeSchema } from '@msr/shared/schemas/cardTypes';
import { uuidSchema } from '@msr/shared/schemas/project';
import { paymentRequired } from '../../lib/httpError';
import { assertCanWrite, projectOf, type ProjectContext } from '../projects/access';
import { currentTier } from '../shop/service';
import { createCardType, deleteCardType, updateCardType } from './service';

const assertAllowed = async (project: ProjectContext) => {
  if (!cardTypesAllowed(await currentTier(project.ownerId), project.module))
    throw paymentRequired('Custom card types come with the Pro plan, or in Startup projects');
};

export const createCardTypesRouter = () => {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_workflow');
    const input = cardTypeSchema.parse(req.body);
    await assertAllowed(project);
    res.status(201).json({ cardType: await createCardType(project, input) });
  });

  router.patch('/:cardTypeId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_workflow');
    const id = uuidSchema.parse(req.params.cardTypeId);
    const input = updateCardTypeSchema.parse(req.body);
    await assertAllowed(project);
    res.json({ cardType: await updateCardType(project, id, input) });
  });

  router.delete('/:cardTypeId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_workflow');
    await deleteCardType(project, uuidSchema.parse(req.params.cardTypeId));
    res.status(204).end();
  });

  return router;
};
