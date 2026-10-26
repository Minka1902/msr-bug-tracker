import { query, type Db } from '../../db/pool';

const LEVELS = "ARRAY['low', 'medium', 'high', 'urgent']::task_priority[]";

const ESCALATE = `
  WITH target AS (
    SELECT t.id, t.project_id, t.priority AS old_priority,
           (${LEVELS})[w.first_level + s.direction * CASE
             WHEN w.today >= t.due_date THEN s.steps
             WHEN w.today <= w.first_day THEN 0
             ELSE least(s.steps, (w.today - w.first_day) * (s.steps + 1) / (t.due_date - w.first_day))
           END] AS new_priority
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users r ON r.id = t.reporter_id
    CROSS JOIN LATERAL (
      SELECT (now() AT TIME ZONE coalesce(a.preferences->>'timezone', r.preferences->>'timezone', 'UTC'))::date AS today,
             least(coalesce(t.start_date, t.escalate_since), t.due_date) AS first_day,
             array_position(${LEVELS}, t.escalate_from) AS first_level,
             array_position(${LEVELS}, t.escalate_to) AS last_level
    ) w
    CROSS JOIN LATERAL (
      SELECT abs(w.last_level - w.first_level) AS steps, sign(w.last_level - w.first_level)::int AS direction
    ) s
    WHERE t.escalate_from IS NOT NULL AND t.completed_at IS NULL AND ($1::uuid[] IS NULL OR t.id = ANY($1::uuid[]))
  ), changed AS (
    UPDATE tasks t SET priority = target.new_priority, updated_at = now()
    FROM target
    WHERE t.id = target.id AND t.priority <> target.new_priority
    RETURNING t.id, t.project_id, target.old_priority, target.new_priority
  )
  INSERT INTO task_activity (project_id, task_id, action, field, old_value, new_value)
  SELECT project_id, id, 'escalated', 'priority', to_jsonb(old_priority), to_jsonb(new_priority)
  FROM changed WHERE $2::boolean`;

export const escalatePriorities = async (taskIds: string[] | null, log: boolean, db?: Db) => {
  await query(ESCALATE, [taskIds, log], db);
};
