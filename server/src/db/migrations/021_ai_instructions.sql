ALTER TABLE projects ADD COLUMN ai_start text NOT NULL DEFAULT '' CHECK (length(ai_start) <= 4000),
  ADD COLUMN ai_finish text NOT NULL DEFAULT '' CHECK (length(ai_finish) <= 4000);
