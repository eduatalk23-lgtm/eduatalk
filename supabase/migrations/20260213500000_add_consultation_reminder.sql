-- D-1 리마인더 알림 지원을 위한 컬럼 추가
-- consultation_schedules 테이블에 리마인더 발송 추적 컬럼 추가

ALTER TABLE consultation_schedules
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
