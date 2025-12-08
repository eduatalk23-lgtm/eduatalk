-- tenants 테이블에 출석 SMS 수신자 선택 컬럼 추가

-- 출석 SMS 수신자 선택 컬럼 추가
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS attendance_sms_recipient text DEFAULT 'auto' CHECK (attendance_sms_recipient IN ('mother', 'father', 'both', 'auto'));

-- 컬럼 설명 추가
COMMENT ON COLUMN tenants.attendance_sms_recipient IS '출석 SMS 알림 수신자 선택: mother(어머니만), father(아버지만), both(둘 다), auto(먼저 있는 번호, 기본값)';

