import { query } from '../../db/pool';

const CARRY_OVER = `
  WITH due AS (
    SELECT t.id, t.project_id, t.due_date,
           ($1::timestamptz AT TIME ZONE coalesce(a.preferences->>'timezone', r.preferences->>'timezone', 'UTC'))::date AS today
    FROM tasks t
    JOIN projects p ON p.id = t.project_id AND p.module = 'household' AND p.archived_at IS NULL
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users r ON r.id = t.reporter_id
    WHERE t.carry_over AND t.completed_at IS NULL AND t.due_date IS NOT NULL
  ), moved AS (
    UPDATE tasks t SET carried_from = coalesce(t.carried_from, t.due_date), due_date = due.today, start_date = t.start_date + (due.today - due.due_date), updated_at = now()
    FROM due
    WHERE t.id = due.id AND due.due_date < due.today
    RETURNING t.id, t.project_id, due.due_date AS old_due, due.today AS new_due
  )
  INSERT INTO task_activity (project_id, task_id, action, field, old_value, new_value)
  SELECT project_id, id, 'carried_over', 'dueDate', to_jsonb(old_due::text), to_jsonb(new_due::text) FROM moved`;

export const carryOverTasks = async (at: Date = new Date()) => {
  await query(CARRY_OVER, [at]);
};
