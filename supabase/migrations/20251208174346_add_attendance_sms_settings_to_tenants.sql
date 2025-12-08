-- tenants 테이블에 출석 SMS 설정 컬럼 추가

-- 출석 SMS 설정 컬럼 추가
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS attendance_sms_check_in_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS attendance_sms_check_out_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS attendance_sms_absent_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS attendance_sms_late_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS attendance_sms_student_checkin_enabled boolean DEFAULT false;

-- 컬럼 설명 추가
COMMENT ON COLUMN tenants.attendance_sms_check_in_enabled IS '입실 알림 SMS 발송 활성화 여부 (기본값: true)';
COMMENT ON COLUMN tenants.attendance_sms_check_out_enabled IS '퇴실 알림 SMS 발송 활성화 여부 (기본값: true)';
COMMENT ON COLUMN tenants.attendance_sms_absent_enabled IS '결석 알림 SMS 발송 활성화 여부 (기본값: true)';
COMMENT ON COLUMN tenants.attendance_sms_late_enabled IS '지각 알림 SMS 발송 활성화 여부 (기본값: true)';
COMMENT ON COLUMN tenants.attendance_sms_student_checkin_enabled IS '학생 직접 체크인/퇴실 시 SMS 발송 활성화 여부 (기본값: false)';

