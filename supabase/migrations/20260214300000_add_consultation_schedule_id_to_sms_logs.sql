-- sms_logs 테이블에 consultation_schedule_id FK 추가
-- ON DELETE SET NULL: 일정 삭제돼도 발송 로그 보존 (감사 기록)
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS consultation_schedule_id UUID
  REFERENCES consultation_schedules(id) ON DELETE SET NULL;

-- 부분 인덱스: NULL이 아닌 행만 인덱싱 (대부분 SMS는 상담과 무관)
CREATE INDEX IF NOT EXISTS idx_sms_logs_consultation_schedule_id
  ON sms_logs(consultation_schedule_id)
  WHERE consultation_schedule_id IS NOT NULL;
