-- 반복 이벤트(rrule) 쿼리 최적화를 위한 부분 인덱스
-- 기존 쿼리가 rrule IS NOT NULL 조건으로 필터하므로 부분 인덱스가 효율적
CREATE INDEX IF NOT EXISTS idx_cal_events_rrule_not_null
  ON calendar_events(calendar_id, start_at)
  WHERE rrule IS NOT NULL AND deleted_at IS NULL;
