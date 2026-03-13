-- Composite index for recurring event exception queries
-- Used by: deleteRecurringEvent, updateRecurringEvent (this_and_following, all scopes)
-- Pattern: .eq('recurring_event_id', parentId).eq('is_exception', true).is('deleted_at', null)
CREATE INDEX IF NOT EXISTS idx_cal_events_recurring_exception
  ON calendar_events (recurring_event_id, is_exception)
  WHERE is_exception = true AND deleted_at IS NULL;
