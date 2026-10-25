CREATE TYPE task_type AS ENUM ('task', 'bug', 'feature', 'improvement');
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE bug_severity AS ENUM ('critical', 'major', 'minor', 'trivial');
CREATE TYPE bug_reproducibility AS ENUM ('always', 'sometimes', 'rarely');
CREATE TYPE relation_type AS ENUM ('relates', 'duplicates', 'blocks');

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type task_type NOT NULL DEFAULT 'task',
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  description text NOT NULL DEFAULT '',
  status_id uuid NOT NULL REFERENCES project_statuses(id),
  priority task_priority NOT NULL DEFAULT 'medium',
  severity bug_severity,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  completed_at timestamptz,
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  position text COLLATE "C" NOT NULL,
  steps_to_reproduce text NOT NULL DEFAULT '',
  expected_behavior text NOT NULL DEFAULT '',
  actual_behavior text NOT NULL DEFAULT '',
  env_os text NOT NULL DEFAULT '',
  env_browser text NOT NULL DEFAULT '',
  env_app_version text NOT NULL DEFAULT '',
  found_in_version text NOT NULL DEFAULT '',
  fix_version text NOT NULL DEFAULT '',
  reproducibility bug_reproducibility,
  comment_count integer NOT NULL DEFAULT 0,
  attachment_count integer NOT NULL DEFAULT 0,
  checklist_total integer NOT NULL DEFAULT 0,
  checklist_done integer NOT NULL DEFAULT 0,
  subtask_total integer NOT NULL DEFAULT 0,
  subtask_done integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', left(description, 20000)), 'B')
  ) STORED,
  UNIQUE (project_id, number),
  CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
);

CREATE INDEX tasks_board_idx ON tasks (project_id, status_id, position);
CREATE INDEX tasks_assignee_open_idx ON tasks (assignee_id) WHERE completed_at IS NULL;
CREATE INDEX tasks_due_idx ON tasks (project_id, due_date);
CREATE INDEX tasks_updated_idx ON tasks (project_id, updated_at DESC);
CREATE INDEX tasks_parent_idx ON tasks (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX tasks_status_idx ON tasks (status_id);
CREATE INDEX tasks_search_idx ON tasks USING gin (search_vector);
CREATE INDEX tasks_title_trgm_idx ON tasks USING gin (title gin_trgm_ops);

CREATE TABLE task_aliases (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, number)
);

CREATE TABLE task_labels (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE INDEX task_labels_label_idx ON task_labels (label_id);

CREATE TABLE task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  is_done boolean NOT NULL DEFAULT false,
  position text COLLATE "C" NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_checklist_task_idx ON task_checklist_items (task_id, position);

CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES task_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

CREATE INDEX task_comments_task_idx ON task_comments (task_id, created_at);

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES task_comments(id) ON DELETE SET NULL,
  uploader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  storage_key text NOT NULL UNIQUE,
  name text NOT NULL,
  mime text NOT NULL,
  size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attachments_task_idx ON attachments (task_id, created_at);
CREATE INDEX attachments_pending_idx ON attachments (uploader_id, created_at) WHERE task_id IS NULL;

CREATE TABLE task_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type relation_type NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_id <> target_id),
  UNIQUE (source_id, target_id, type)
);

CREATE INDEX task_relations_target_idx ON task_relations (target_id);

CREATE TABLE task_activity (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  field text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_activity_project_idx ON task_activity (project_id, created_at DESC);
CREATE INDEX task_activity_task_idx ON task_activity (task_id, created_at) WHERE task_id IS NOT NULL;
