CREATE TABLE demo_sets (
  owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seed integer NOT NULL,
  size text NOT NULL CHECK (size IN ('small', 'large')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_demo_owner_idx ON projects (owner_id) WHERE is_demo;
