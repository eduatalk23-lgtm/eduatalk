-- student_notification_preferences 테이블에 출석 설정 컬럼 추가
-- 테이블이 없는 경우 생성

CREATE TABLE IF NOT EXISTS student_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_start_enabled boolean DEFAULT true,
  plan_complete_enabled boolean DEFAULT true,
  daily_goal_achieved_enabled boolean DEFAULT true,
  weekly_report_enabled boolean DEFAULT true,
  plan_delay_enabled boolean DEFAULT true,
  plan_delay_threshold_minutes integer DEFAULT 30,
  notification_time_start time DEFAULT '09:00',
  notification_time_end time DEFAULT '22:00',
  quiet_hours_enabled boolean DEFAULT false,
  quiet_hours_start time DEFAULT '22:00',
  quiet_hours_end time DEFAULT '08:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id)
);

-- 출석 관련 설정 컬럼 추가
ALTER TABLE student_notification_preferences 
ADD COLUMN IF NOT EXISTS attendance_check_in_enabled boolean,
ADD COLUMN IF NOT EXISTS attendance_check_out_enabled boolean,
ADD COLUMN IF NOT EXISTS attendance_absent_enabled boolean,
ADD COLUMN IF NOT EXISTS attendance_late_enabled boolean;

-- 컬럼 설명 추가
COMMENT ON COLUMN student_notification_preferences.attendance_check_in_enabled IS '학생별 입실 알림 설정 (NULL이면 학원 기본 설정 사용)';
COMMENT ON COLUMN student_notification_preferences.attendance_check_out_enabled IS '학생별 퇴실 알림 설정 (NULL이면 학원 기본 설정 사용)';
COMMENT ON COLUMN student_notification_preferences.attendance_absent_enabled IS '학생별 결석 알림 설정 (NULL이면 학원 기본 설정 사용)';
COMMENT ON COLUMN student_notification_preferences.attendance_late_enabled IS '학생별 지각 알림 설정 (NULL이면 학원 기본 설정 사용)';

-- updated_at 자동 업데이트 트리거 (없는 경우에만 생성)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_student_notification_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_student_notification_preferences_updated_at
      BEFORE UPDATE ON student_notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

