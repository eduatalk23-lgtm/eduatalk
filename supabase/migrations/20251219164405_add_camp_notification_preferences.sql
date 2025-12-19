-- student_notification_preferences 테이블에 캠프 관련 알림 설정 컬럼 추가

-- 캠프 관련 알림 설정 컬럼 추가
ALTER TABLE student_notification_preferences 
ADD COLUMN IF NOT EXISTS camp_invitation_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS camp_reminder_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS camp_status_change_enabled boolean DEFAULT true;

-- 컬럼 설명 추가
COMMENT ON COLUMN student_notification_preferences.camp_invitation_enabled IS '캠프 초대 알림 설정 (기본값: true)';
COMMENT ON COLUMN student_notification_preferences.camp_reminder_enabled IS '캠프 리마인더 알림 설정 (기본값: true)';
COMMENT ON COLUMN student_notification_preferences.camp_status_change_enabled IS '캠프 상태 변경 알림 설정 (기본값: true)';

