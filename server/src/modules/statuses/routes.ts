import { Router } from 'express';
import { createStatusSchema, deleteStatusSchema, updateStatusSchema } from '@msr/shared/schemas/project';
import { assertCanWrite, projectOf } from '../projects/access';
import { createStatus, deleteStatus, updateStatus } from './service';

export const createStatusesRouter = () => {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_workflow');
    res.status(201).json({ status: await createStatus(project.id, createStatusSchema.parse(req.body)) });
  });

  router.patch('/:statusId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_workflow');
    res.json({
      status: await updateStatus(project.id, req.params.statusId!, updateStatusSchema.parse(req.body)),
    });
  });

  router.delete('/:statusId', async (req, res) => {
    const project = projectOf(req);
    assertCanWrite(project, 'project.manage_workflow');
    await deleteStatus(
      project.id,
      req.params.statusId!,
      deleteStatusSchema.parse(req.body).moveTo,
      req.user!.id,
    );
    res.status(204).end();
  });

  return router;
};
