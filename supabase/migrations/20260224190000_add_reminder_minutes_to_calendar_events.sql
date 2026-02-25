-- Add reminder_minutes array column to calendar_events
-- Stores notification reminders as array of minutes-before values (e.g., [10, 30] for 10min and 30min before)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS reminder_minutes integer[] DEFAULT NULL;

COMMENT ON COLUMN calendar_events.reminder_minutes IS 'Array of reminder offsets in minutes before event start (e.g., [10, 30])';
