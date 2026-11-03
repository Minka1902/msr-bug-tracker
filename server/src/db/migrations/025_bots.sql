CREATE TYPE bot_platform AS ENUM ('telegram', 'discord');

ALTER TABLE telegram_chats RENAME TO bot_chats;
ALTER TABLE bot_chats DROP CONSTRAINT telegram_chats_pkey,
  ADD COLUMN platform bot_platform NOT NULL DEFAULT 'telegram',
  ALTER COLUMN chat_id TYPE text USING chat_id::text;
ALTER TABLE bot_chats ALTER COLUMN platform DROP DEFAULT, ADD PRIMARY KEY (platform, chat_id, project_id);
ALTER INDEX telegram_chats_project_idx RENAME TO bot_chats_project_idx;

ALTER TABLE telegram_link_codes RENAME TO bot_link_codes;
ALTER TABLE bot_link_codes ADD COLUMN platform bot_platform NOT NULL DEFAULT 'telegram';
ALTER TABLE bot_link_codes ALTER COLUMN platform DROP DEFAULT;

ALTER TABLE telegram_outbox RENAME TO bot_outbox;
ALTER TABLE bot_outbox ALTER COLUMN source_chat_id TYPE text USING source_chat_id::text,
  ADD COLUMN source_platform bot_platform;
UPDATE bot_outbox SET source_platform = 'telegram' WHERE source_chat_id IS NOT NULL;

ALTER TABLE telegram_state RENAME TO bot_state;

CREATE TABLE bot_accounts (
  platform bot_platform NOT NULL,
  external_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (platform, external_id),
  UNIQUE (platform, user_id)
);
INSERT INTO bot_accounts (platform, external_id, user_id)
SELECT 'telegram', telegram_user_id::text, id FROM users WHERE telegram_user_id IS NOT NULL;
ALTER TABLE users DROP COLUMN telegram_user_id;
