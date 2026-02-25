-- Drop calendar_type column from calendars table
-- Calendar type distinction is now handled at the event level (EventType),
-- and calendar identity is expressed via summary/description fields.

ALTER TABLE calendars DROP COLUMN IF EXISTS calendar_type;
