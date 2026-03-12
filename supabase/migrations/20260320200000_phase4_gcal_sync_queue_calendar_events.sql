-- Phase 4: google_calendar_sync_queue FK를 consultation_schedules → calendar_events로 변경
-- schedule_id 컬럼이 calendar_events.id를 참조하도록 변경

-- 1. 기존 FK 제약 해제
ALTER TABLE google_calendar_sync_queue
  DROP CONSTRAINT IF EXISTS google_calendar_sync_queue_schedule_id_fkey;

-- 2. 새 FK 추가 (calendar_events.id 참조)
-- 기존 pending/failed 큐 항목은 consultation_schedules.id를 갖고 있으므로
-- Phase 5 데이터 마이그레이션 전에는 FK를 추가하지 않고 soft reference로 유지
-- ALTER TABLE google_calendar_sync_queue
--   ADD CONSTRAINT google_calendar_sync_queue_schedule_id_fkey
--   FOREIGN KEY (schedule_id) REFERENCES calendar_events(id) ON DELETE CASCADE;

-- 3. consultation_event_data에 reminder_sent 관련 컬럼이 없으면 추가
-- (이미 20260320100000에서 추가됨, 안전을 위해 IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consultation_event_data' AND column_name = 'reminder_sent'
  ) THEN
    ALTER TABLE consultation_event_data ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consultation_event_data' AND column_name = 'reminder_sent_at'
  ) THEN
    ALTER TABLE consultation_event_data ADD COLUMN reminder_sent_at TIMESTAMPTZ;
  END IF;
END $$;
