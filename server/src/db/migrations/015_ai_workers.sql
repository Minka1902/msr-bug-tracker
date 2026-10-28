ALTER TABLE users ADD COLUMN agent_owner_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX users_agent_owner_idx ON users (agent_owner_id) WHERE agent_owner_id IS NOT NULL;

ALTER TABLE oauth_grants ADD COLUMN agent_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE;
