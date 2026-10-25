import type { Label } from '@msr/shared/types';
import { query, queryOne, type Db } from '../../db/pool';
import { notFound } from '../../lib/httpError';

const LIST_LABELS = 'SELECT id, name, color FROM labels WHERE project_id = $1 ORDER BY lower(name)';
const INSERT_LABEL =
  'INSERT INTO labels (project_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color';
const UPDATE_LABEL = `
  UPDATE labels SET name = COALESCE($3, name), color = COALESCE($4, color)
  WHERE id = $1 AND project_id = $2 RETURNING id, name, color`;
const DELETE_LABEL = 'DELETE FROM labels WHERE id = $1 AND project_id = $2 RETURNING id';

export const listLabels = (projectId: string, db?: Db) => query<Label>(LIST_LABELS, [projectId], db);

export const createLabel = (projectId: string, name: string, color: string) =>
  queryOne<Label>(INSERT_LABEL, [projectId, name, color]).then((label) => label!);

export const updateLabel = async (
  projectId: string,
  labelId: string,
  input: { name?: string; color?: string },
) => {
  const label = await queryOne<Label>(UPDATE_LABEL, [
    labelId,
    projectId,
    input.name ?? null,
    input.color ?? null,
  ]);
  if (!label) throw notFound('Label not found');
  return label;
};

export const deleteLabel = async (projectId: string, labelId: string) => {
  if (!(await queryOne(DELETE_LABEL, [labelId, projectId]))) throw notFound('Label not found');
};
