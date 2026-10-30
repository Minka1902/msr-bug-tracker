ALTER TABLE attachments DROP CONSTRAINT attachments_storage_key_key;
CREATE INDEX attachments_storage_key_idx ON attachments (storage_key);
