ALTER TYPE task_type ADD VALUE 'chore';
ALTER TYPE task_type ADD VALUE 'errand';

CREATE TYPE project_kind AS ENUM ('software', 'household');
ALTER TABLE projects ADD COLUMN kind project_kind NOT NULL DEFAULT 'software';

ALTER TABLE tasks ADD COLUMN recurrence jsonb;

UPDATE project_roles
SET permissions = permissions
  | CASE WHEN permissions & 8 <> 0 THEN 262144 ELSE 0 END
  | CASE WHEN permissions & 1 <> 0 THEN 524288 ELSE 0 END;

CREATE TABLE shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  position text COLLATE "C" NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shopping_lists_project_idx ON shopping_lists (project_id, position);

CREATE TABLE shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  quantity text NOT NULL DEFAULT '' CHECK (length(quantity) <= 40),
  is_checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  checked_at timestamptz,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  position text COLLATE "C" NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shopping_items_list_idx ON shopping_items (list_id, is_checked, position);
