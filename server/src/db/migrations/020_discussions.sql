ALTER TYPE task_type ADD VALUE 'discussion';

ALTER TABLE tasks ADD COLUMN decision text NOT NULL DEFAULT '' CHECK (length(decision) <= 20000),
  ADD CONSTRAINT tasks_discussion_decision
    CHECK (type::text <> 'discussion' OR completed_at IS NULL OR btrim(decision) <> '');
