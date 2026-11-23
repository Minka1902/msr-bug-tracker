ALTER TABLE bot_chats ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'he', 'ru'));
