import { CARD_TYPES_MAX, MODULE_META } from '@msr/shared/modules';
import type { CardTypeInput, UpdateCardTypeInput } from '@msr/shared/schemas/cardTypes';
import type { CardType } from '@msr/shared/types';
import { query, queryOne } from '../../db/pool';
import { badRequest, notFound } from '../../lib/httpError';
import type { ProjectContext } from '../projects/access';

const COLUMNS =
  'id, name, base, icon, color, create_role_ids AS "createRoleIds", edit_role_ids AS "editRoleIds"';
const ROLES_IN_PROJECT =
  'SELECT count(*)::int AS count FROM project_roles WHERE project_id = $1 AND id = ANY($2::uuid[])';
const INSERT_CARD_TYPE = `
  INSERT INTO project_card_types (project_id, base, name, icon, color, create_role_ids, edit_role_ids)
  SELECT $1, $2, $3, $4, $5, $6, $7
  WHERE (SELECT count(*) FROM project_card_types WHERE project_id = $1) < $8
  RETURNING ${COLUMNS}`;
const UPDATE_CARD_TYPE = `
  UPDATE project_card_types
  SET name = COALESCE($3, name), icon = COALESCE($4, icon), color = COALESCE($5, color),
      create_role_ids = COALESCE($6, create_role_ids), edit_role_ids = COALESCE($7, edit_role_ids)
  WHERE id = $1 AND project_id = $2
  RETURNING ${COLUMNS}`;
const DELETE_CARD_TYPE = 'DELETE FROM project_card_types WHERE id = $1 AND project_id = $2 RETURNING id';

const assertRoles = async (projectId: string, ...lists: (string[] | undefined)[]) => {
  const ids = [...new Set(lists.flatMap((list) => list ?? []))];
  if (!ids.length) return;
  const found = await queryOne<{ count: number }>(ROLES_IN_PROJECT, [projectId, ids]);
  if (found!.count !== ids.length) throw badRequest('Pick roles from this project');
};

export const createCardType = async (project: ProjectContext, input: CardTypeInput) => {
  if (!MODULE_META[project.module].taskTypes.includes(input.base))
    throw badRequest('Base the card type on one of this project’s card types');
  await assertRoles(project.id, input.createRoleIds, input.editRoleIds);
  const created = await queryOne<CardType>(INSERT_CARD_TYPE, [
    project.id,
    input.base,
    input.name,
    input.icon,
    input.color,
    input.createRoleIds,
    input.editRoleIds,
    CARD_TYPES_MAX,
  ]);
  if (!created) throw badRequest(`A project can have up to ${CARD_TYPES_MAX} card types`);
  return created;
};

export const updateCardType = async (project: ProjectContext, id: string, input: UpdateCardTypeInput) => {
  await assertRoles(project.id, input.createRoleIds, input.editRoleIds);
  const updated = await queryOne<CardType>(UPDATE_CARD_TYPE, [
    id,
    project.id,
    input.name ?? null,
    input.icon ?? null,
    input.color ?? null,
    input.createRoleIds ?? null,
    input.editRoleIds ?? null,
  ]);
  if (!updated) throw notFound('Card type not found');
  return updated;
};

export const deleteCardType = async (project: ProjectContext, id: string) => {
  if (!(await query(DELETE_CARD_TYPE, [id, project.id])).length) throw notFound('Card type not found');
};
