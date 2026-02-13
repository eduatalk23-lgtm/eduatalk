-- SMS 예약 발송을 위한 scheduled_at 컬럼 추가
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 예약 상태 SMS 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_sms_logs_scheduled
  ON sms_logs(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';
