ALTER TABLE users ADD COLUMN telegram_user_id bigint UNIQUE;

CREATE TABLE telegram_chats (
  chat_id bigint NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  is_group boolean NOT NULL,
  linked_by uuid REFERENCES users(id) ON DELETE CASCADE,
  notify text[] NOT NULL DEFAULT '{task_assigned,appointment_reminders,daily_digest}',
  only_mine boolean NOT NULL DEFAULT true,
  default_list_id uuid REFERENCES shopping_lists(id) ON DELETE SET NULL,
  digest_sent_on date,
  selected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, project_id)
);

CREATE INDEX telegram_chats_project_idx ON telegram_chats (project_id);

CREATE TABLE telegram_link_codes (
  code_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  is_group boolean NOT NULL,
  expires_at timestamptz NOT NULL
);
