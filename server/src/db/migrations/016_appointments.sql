ALTER TABLE calendar_events
  ADD COLUMN is_appointment boolean NOT NULL DEFAULT false,
  ADD COLUMN reminders int[] NOT NULL DEFAULT '{}',
  ADD COLUMN reminders_sent int[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT calendar_events_appointment_project CHECK (NOT is_appointment OR project_id IS NOT NULL),
  ADD CONSTRAINT calendar_events_reminders_appointment CHECK (is_appointment OR reminders = '{}');

CREATE INDEX calendar_events_appointment_idx ON calendar_events (starts_at) WHERE is_appointment AND reminders <> '{}';
