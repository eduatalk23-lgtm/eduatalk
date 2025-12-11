-- 출석 SMS 발송 실패 시 사용자에게 알림 표시 여부 설정 추가
-- 기본값: false (현재 동작 유지)

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS attendance_sms_show_failure_to_user BOOLEAN DEFAULT false;

COMMENT ON COLUMN tenants.attendance_sms_show_failure_to_user IS '출석 SMS 발송 실패 시 사용자에게 알림을 표시할지 여부';

