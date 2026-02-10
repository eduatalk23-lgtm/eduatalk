-- SMS 발송 결과 추적을 위한 컬럼 추가
-- message_key: 뿌리오가 반환하는 messageKey (발송 결과 매칭용)
-- ref_key: 우리가 부여한 참조 키 (cmsgid 매칭용)
-- ppurio_result_code: 뿌리오 배달 결과 코드 (예: "4100" = 성공)

ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS message_key TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS ref_key TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS ppurio_result_code TEXT;

CREATE INDEX IF NOT EXISTS idx_sms_logs_message_key ON sms_logs(message_key) WHERE message_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_logs_pending_delivery ON sms_logs(status) WHERE status = 'sent' AND message_key IS NOT NULL;
