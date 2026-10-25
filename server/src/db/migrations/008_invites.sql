CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE,
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  role_id uuid REFERENCES project_roles(id) ON DELETE CASCADE,
  email citext,
  max_uses integer CHECK (max_uses > 0),
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((project_id IS NULL) = (role_id IS NULL))
);

CREATE INDEX invites_project_idx ON invites (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX invites_inviter_idx ON invites (inviter_id);
