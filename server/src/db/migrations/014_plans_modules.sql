CREATE TYPE project_module AS ENUM ('software', 'personal', 'household', 'skill', 'startup');
CREATE TYPE plan_tier AS ENUM ('personal', 'pro');

ALTER TABLE projects ADD COLUMN module project_module NOT NULL DEFAULT 'software';
UPDATE projects SET module = 'household' WHERE kind = 'household';

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier plan_tier NOT NULL,
  price_cents int NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, expires_at DESC);

CREATE TABLE module_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module project_module NOT NULL,
  projects int NOT NULL CHECK (projects BETWEEN 1 AND 100),
  projects_used int NOT NULL DEFAULT 0 CHECK (projects_used <= projects),
  price_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX module_packs_open_idx ON module_packs (user_id, module, created_at) WHERE projects_used < projects;

CREATE TABLE project_creations (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  pack_id uuid REFERENCES module_packs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_creations_plan_idx ON project_creations (user_id, created_at) WHERE pack_id IS NULL;
