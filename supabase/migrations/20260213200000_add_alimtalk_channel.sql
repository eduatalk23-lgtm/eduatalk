-- 카카오 알림톡 채널 지원을 위한 sms_logs 테이블 확장

-- 발송 채널 추적
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'sms'
  CHECK (channel IN ('sms', 'lms', 'alimtalk', 'friendtalk'));

-- 알림톡 실패 시 SMS 대체 발송 여부
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN DEFAULT FALSE;

-- 알림톡 템플릿 코드 저장
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS alimtalk_template_code TEXT;

-- 채널별 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_sms_logs_channel
  ON sms_logs(channel);
