ALTER TABLE attachments ADD COLUMN purged_at timestamptz;

CREATE INDEX tasks_done_with_files_idx ON tasks (completed_at) WHERE attachment_count > 0;
