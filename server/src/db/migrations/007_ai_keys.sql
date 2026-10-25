CREATE TABLE user_api_keys (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google', 'xai')),
  key_sealed text NOT NULL,
  last4 text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
