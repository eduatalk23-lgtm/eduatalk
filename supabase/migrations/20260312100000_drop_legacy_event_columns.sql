-- Stage 2: Drop legacy event classification columns
-- Run AFTER Stage 1 migration (20260311100000) has been verified in production.
--
-- Removes:
--   event_type, event_subtype  (replaced by label + is_task + is_exclusion)
--   icon, priority, tags, visibility, transparency  (unused columns)

BEGIN;

-- Drop constraint if exists
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS chk_event_type;

-- Drop legacy classification columns
ALTER TABLE calendar_events DROP COLUMN IF EXISTS event_type;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS event_subtype;

-- Drop unused columns
ALTER TABLE calendar_events DROP COLUMN IF EXISTS icon;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS priority;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS tags;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS visibility;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS transparency;

COMMIT;
