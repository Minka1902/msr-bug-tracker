import { Router, type Request } from 'express';
import { MODULE_META } from '@msr/shared/modules';
import { createPlaceSchema, updatePlaceSchema } from '@msr/shared/schemas/place';
import { notFound } from '../../lib/httpError';
import { uuidSchema } from '@msr/shared/schemas/project';
import { assertCanWrite, projectOf } from '../projects/access';
import { createPlace, deletePlace, listPlaces, updatePlace } from './service';

const PLACE_NOT_FOUND = 'Place not found';

const householdOf = (req: Request) => {
  const project = projectOf(req);
  if (MODULE_META[project.module].kind !== 'household') throw notFound('Places belong to a household');
  return project;
};

const editableHousehold = (req: Request) => {
  const project = householdOf(req);
  assertCanWrite(project, 'lists.edit');
  return project;
};

const placeIdOf = (req: Request) => {
  const parsed = uuidSchema.safeParse(req.params.placeId);
  if (!parsed.success) throw notFound(PLACE_NOT_FOUND);
  return parsed.data;
};

export const createPlacesRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    res.json({ places: await listPlaces(householdOf(req).id) });
  });

  router.post('/', async (req, res) => {
    const project = editableHousehold(req);
    res
      .status(201)
      .json({ place: await createPlace(project.id, req.user!.id, createPlaceSchema.parse(req.body)) });
  });

  router.patch('/:placeId', async (req, res) => {
    const project = editableHousehold(req);
    const place = await updatePlace(project.id, placeIdOf(req), updatePlaceSchema.parse(req.body));
    if (!place) throw notFound(PLACE_NOT_FOUND);
    res.json({ place });
  });

  router.delete('/:placeId', async (req, res) => {
    const project = editableHousehold(req);
    if (!(await deletePlace(project.id, placeIdOf(req)))) throw notFound(PLACE_NOT_FOUND);
    res.status(204).end();
  });

  return router;
};
