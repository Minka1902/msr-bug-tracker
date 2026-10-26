ALTER TABLE tasks
  ADD COLUMN escalate_from task_priority,
  ADD COLUMN escalate_to task_priority,
  ADD COLUMN escalate_since date,
  ADD CONSTRAINT tasks_escalation_check CHECK (
    (escalate_from IS NULL AND escalate_to IS NULL AND escalate_since IS NULL)
    OR (escalate_from IS NOT NULL AND escalate_to IS NOT NULL AND escalate_from <> escalate_to
        AND escalate_since IS NOT NULL AND due_date IS NOT NULL)
  );

CREATE INDEX tasks_escalating_idx ON tasks (id) WHERE escalate_from IS NOT NULL AND completed_at IS NULL;
