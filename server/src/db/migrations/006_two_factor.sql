ALTER TYPE auth_token_type ADD VALUE 'two_factor';

ALTER TABLE users
  ADD COLUMN totp_secret text,
  ADD COLUMN totp_enabled_at timestamptz,
  ADD COLUMN totp_last_step bigint;

CREATE TABLE recovery_codes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash bytea NOT NULL,
  used_at timestamptz,
  PRIMARY KEY (user_id, code_hash)
);
