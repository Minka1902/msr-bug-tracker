import { Router } from 'express';
import { labelSchema, updateLabelSchema } from '@msr/shared/schemas/project';
import { assertCanWrite, projectOf } from '../projects/access';
import { createLabel, deleteLabel, updateLabel } from './service';

export const createLabelsRouter = () => {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_labels');
    const { name, color } = labelSchema.parse(req.body);
    res.status(201).json({ label: await createLabel(project.id, name, color) });
  });

  router.patch('/:labelId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_labels');
    res.json({
      label: await updateLabel(project.id, req.params.labelId!, updateLabelSchema.parse(req.body)),
    });
  });

  router.delete('/:labelId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_labels');
    await deleteLabel(project.id, req.params.labelId!);
    res.status(204).end();
  });

  return router;
};
