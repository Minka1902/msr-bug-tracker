CREATE TABLE project_card_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base task_type NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  icon text NOT NULL,
  color text NOT NULL,
  create_role_ids uuid[] NOT NULL DEFAULT '{}',
  edit_role_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, id)
);

CREATE UNIQUE INDEX project_card_types_name_idx ON project_card_types (project_id, lower(name));

ALTER TABLE tasks ADD COLUMN card_type_id uuid,
  ADD CONSTRAINT tasks_card_type_fkey FOREIGN KEY (project_id, card_type_id)
    REFERENCES project_card_types (project_id, id) ON DELETE SET NULL (card_type_id);

CREATE INDEX tasks_card_type_idx ON tasks (card_type_id) WHERE card_type_id IS NOT NULL;
