import { Router } from 'express';
import { canEditTask } from '@msr/shared/permissions';
import { formatIdentifier, parseIdentifier } from '@msr/shared/identifiers';
import { createRelationSchema } from '@msr/shared/schemas/collab';
import { badRequest, forbidden, notFound } from '../../lib/httpError';
import { assertCanEditTask, loadTaskAccess } from '../tasks/access';
import { resolveIdentifier } from '../tasks/service';
import { createRelation, deleteRelation, getRelation, listRelations } from './service';

export const createRelationsRouter = () => {
  const router = Router();

  router.get('/tasks/:taskId/relations', async (req, res) => {
    if (!(await loadTaskAccess(req.params.taskId, req.user!.id))) throw notFound('Task not found');
    res.json({ relations: await listRelations(req.params.taskId, req.user!.id) });
  });

  router.post('/tasks/:taskId/relations', async (req, res) => {
    const source = await loadTaskAccess(req.params.taskId, req.user!.id);
    if (!source) throw notFound('Task not found');
    assertCanEditTask(source.project, source.task, req.user!.id);
    const input = createRelationSchema.parse(req.body);
    const parsed = parseIdentifier(input.target)!;
    const targetId = await resolveIdentifier(parsed.key, parsed.number);
    const target = targetId && (await loadTaskAccess(targetId, req.user!.id));
    if (!target) throw notFound(`${parsed.key}-${parsed.number} was not found`);
    if (target.task.id === source.task.id) throw badRequest("A task can't be linked to itself");
    const id = await createRelation(
      {
        id: source.task.id,
        projectId: source.project.id,
        identifier: formatIdentifier(source.project.key, source.task.number),
      },
      { id: target.task.id, identifier: formatIdentifier(target.project.key, target.task.number) },
      input.type,
      req.user!.id,
    );
    res.status(201).json({
      relation: (await listRelations(source.task.id, req.user!.id)).find((relation) => relation.id === id),
    });
  });

  router.delete('/relations/:id', async (req, res) => {
    const relation = await getRelation(req.params.id);
    if (!relation) throw notFound('Link not found');
    const ends = await Promise.all([
      loadTaskAccess(relation.source_id, req.user!.id),
      loadTaskAccess(relation.target_id, req.user!.id),
    ]);
    const visible = ends.filter((end) => end !== null);
    if (!visible.length) throw notFound('Link not found');
    const editable = visible.some(
      (end) => !end.project.isArchived && canEditTask(end.project.permissions, end.task, req.user!.id),
    );
    if (!editable) {
      assertCanEditTask(visible[0]!.project, visible[0]!.task, req.user!.id);
      throw forbidden();
    }
    await deleteRelation(relation.id);
    res.status(204).end();
  });

  return router;
};
