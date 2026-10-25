CREATE TYPE workflow AS ENUM ('task', 'bug');
CREATE TYPE status_category AS ENUM ('backlog', 'todo', 'in_progress', 'done');
CREATE TYPE system_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key citext NOT NULL UNIQUE CHECK (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '',
  color text NOT NULL,
  icon text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_seq integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  system_key system_role,
  permissions integer NOT NULL CHECK (permissions >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, system_key)
);

CREATE UNIQUE INDEX project_roles_name_idx ON project_roles (project_id, lower(name));

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES project_roles(id) ON DELETE RESTRICT,
  is_favorite boolean NOT NULL DEFAULT false,
  last_opened_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_members_user_idx ON project_members (user_id);
CREATE INDEX project_members_role_idx ON project_members (role_id);

CREATE TABLE project_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow workflow NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  color text NOT NULL,
  category status_category NOT NULL,
  position text COLLATE "C" NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_statuses_name_idx ON project_statuses (project_id, workflow, lower(name));

CREATE TABLE labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX labels_name_idx ON labels (project_id, lower(name));
