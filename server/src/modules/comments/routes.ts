import { Router } from 'express';
import { can } from '@msr/shared/permissions';
import { createCommentSchema, updateCommentSchema } from '@msr/shared/schemas/collab';
import { forbidden, notFound } from '../../lib/httpError';
import { assertCanWrite, assertWritable } from '../projects/access';
import { loadTaskAccess } from '../tasks/access';
import { createComment, deleteComment, getCommentRow, listComments, updateComment } from './service';

export const createCommentsRouter = () => {
  const router = Router();

  const loadComment = async (commentId: string, userId: string) => {
    const comment = await getCommentRow(commentId);
    const access = comment && (await loadTaskAccess(comment.task_id, userId));
    if (!comment || !access) throw notFound('Comment not found');
    assertWritable(access.project);
    if (comment.author_id !== userId && !can(access.project.permissions, 'comment.moderate'))
      throw forbidden(`Your role (${access.project.roleName}) can't change others' comments`, {
        missing: ['comment.moderate'],
      });
    return comment;
  };

  router.get('/tasks/:taskId/comments', async (req, res) => {
    if (!(await loadTaskAccess(req.params.taskId, req.user!.id))) throw notFound('Task not found');
    res.json({ comments: await listComments(req.params.taskId) });
  });

  router.post('/tasks/:taskId/comments', async (req, res) => {
    const access = await loadTaskAccess(req.params.taskId, req.user!.id);
    if (!access) throw notFound('Task not found');
    assertCanWrite(access.project, 'comment.create');
    res.status(201).json({
      comment: await createComment(access.task.id, req.user!.id, createCommentSchema.parse(req.body)),
    });
  });

  router.patch('/comments/:id', async (req, res) => {
    const comment = await loadComment(req.params.id, req.user!.id);
    res.json({
      comment: await updateComment(comment, req.user!.id, updateCommentSchema.parse(req.body)),
    });
  });

  router.delete('/comments/:id', async (req, res) => {
    const comment = await loadComment(req.params.id, req.user!.id);
    await deleteComment(comment.id, comment.task_id);
    res.status(204).end();
  });

  return router;
};
