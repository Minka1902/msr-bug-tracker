CREATE TABLE calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'icloud')),
  account_email text NOT NULL,
  credentials_sealed text NOT NULL,
  calendars jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_calendar_id text,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, account_email)
);

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  is_important boolean NOT NULL DEFAULT false,
  read_only boolean NOT NULL DEFAULT false,
  connection_id uuid REFERENCES calendar_connections(id) ON DELETE CASCADE,
  external_calendar_id text,
  external_id text,
  etag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at),
  CHECK ((owner_id IS NULL) <> (project_id IS NULL))
);

CREATE INDEX calendar_events_owner_idx ON calendar_events (owner_id, starts_at) WHERE owner_id IS NOT NULL;
CREATE INDEX calendar_events_project_idx ON calendar_events (project_id, starts_at) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX calendar_events_external_idx
  ON calendar_events (connection_id, external_calendar_id, external_id) WHERE connection_id IS NOT NULL;

CREATE TABLE calendar_event_attendees (
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX calendar_event_attendees_user_idx ON calendar_event_attendees (user_id);

ALTER TABLE users
  ADD COLUMN calendar_feed_hash bytea UNIQUE,
  ADD COLUMN calendar_feed_token text;

CREATE INDEX tasks_unassigned_due_idx ON tasks (reporter_id, due_date) WHERE assignee_id IS NULL AND due_date IS NOT NULL;
