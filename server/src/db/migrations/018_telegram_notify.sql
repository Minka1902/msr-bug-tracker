CREATE TABLE telegram_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  activity_cursor bigint NOT NULL
);

INSERT INTO telegram_state (activity_cursor) SELECT coalesce(max(id), 0) FROM task_activity;

CREATE TABLE telegram_outbox (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN overdue_alerted_for date;
