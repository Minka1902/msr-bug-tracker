import type { RelationType, StatusCategory, TaskType } from '@msr/shared/enums';
import { formatIdentifier } from '@msr/shared/identifiers';
import type { TaskRelation } from '@msr/shared/types';
import { query, queryOne, transaction } from '../../db/pool';
import { recordActivity } from '../tasks/activity';

interface RelationRow {
  id: string;
  type: RelationType;
  direction: 'outgoing' | 'incoming';
  task_id: string;
  key: string;
  number: number;
  title: string;
  task_type: TaskType;
  category: StatusCategory;
}

const LIST_RELATIONS = `
  SELECT r.id, r.type,
         CASE WHEN r.type = 'relates' OR r.source_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
         o.id AS task_id, p.key::text, o.number, o.title, o.type AS task_type, s.category
  FROM task_relations r
  JOIN tasks o ON o.id = CASE WHEN r.source_id = $1 THEN r.target_id ELSE r.source_id END
  JOIN projects p ON p.id = o.project_id
  JOIN project_statuses s ON s.id = o.status_id
  WHERE (r.source_id = $1 OR r.target_id = $1)
    AND EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = o.project_id AND m.user_id = $2)
  ORDER BY r.created_at`;
const INSERT_RELATION =
  'INSERT INTO task_relations (source_id, target_id, type, created_by) VALUES ($1, $2, $3, $4) RETURNING id';
const GET_RELATION = 'SELECT id, source_id, target_id, type FROM task_relations WHERE id = $1';
const DELETE_RELATION = 'DELETE FROM task_relations WHERE id = $1';

const toRelation = (row: RelationRow): TaskRelation => ({
  id: row.id,
  type: row.type,
  direction: row.direction,
  task: {
    id: row.task_id,
    identifier: formatIdentifier(row.key, row.number),
    title: row.title,
    statusCategory: row.category,
    type: row.task_type,
  },
});

export const listRelations = (taskId: string, userId: string) =>
  query<RelationRow>(LIST_RELATIONS, [taskId, userId]).then((rows) => rows.map(toRelation));

export const getRelation = (id: string) =>
  queryOne<{ id: string; source_id: string; target_id: string; type: RelationType }>(GET_RELATION, [
    id,
  ]).catch(() => undefined);

export const createRelation = (
  source: { id: string; projectId: string; identifier: string },
  target: { id: string; identifier: string },
  type: RelationType,
  actorId: string,
) =>
  transaction(async (db) => {
    const [from, to] =
      type === 'relates' && target.id < source.id ? [target.id, source.id] : [source.id, target.id];
    const created = await queryOne<{ id: string }>(INSERT_RELATION, [from, to, type, actorId], db);
    await recordActivity(
      [
        {
          projectId: source.projectId,
          taskId: source.id,
          actorId,
          action: 'relation_added',
          newValue: target.identifier,
        },
      ],
      db,
    );
    return created!.id;
  });

export const deleteRelation = (id: string) => query(DELETE_RELATION, [id]);
