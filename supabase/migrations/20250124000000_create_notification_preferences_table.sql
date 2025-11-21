-- Migration: Create student_notification_preferences table
-- Description: 학생 알림 설정을 저장하는 테이블 생성
-- Date: 2025-01-23

-- ============================================
-- 1. student_notification_preferences 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS student_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 알림 유형 설정
  plan_start_enabled boolean DEFAULT true,
  plan_complete_enabled boolean DEFAULT true,
  daily_goal_achieved_enabled boolean DEFAULT true,
  weekly_report_enabled boolean DEFAULT true,
  plan_delay_enabled boolean DEFAULT true,
  plan_delay_threshold_minutes integer DEFAULT 30,
  
  -- 알림 시간 설정
  notification_time_start time DEFAULT '09:00:00',
  notification_time_end time DEFAULT '22:00:00',
  
  -- 방해 금지 시간 설정
  quiet_hours_enabled boolean DEFAULT false,
  quiet_hours_start time DEFAULT '22:00:00',
  quiet_hours_end time DEFAULT '08:00:00',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(student_id)
);

-- ============================================
-- 2. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notification_preferences_student_id 
ON student_notification_preferences(student_id);

-- ============================================
-- 3. RLS 정책 설정
-- ============================================

ALTER TABLE student_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 학생은 자신의 알림 설정만 조회/수정 가능
CREATE POLICY "Students can view their own notification preferences"
  ON student_notification_preferences
  FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own notification preferences"
  ON student_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own notification preferences"
  ON student_notification_preferences
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ============================================
-- 4. 업데이트 시간 자동 갱신 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON student_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ============================================
-- 5. 코멘트 추가
-- ============================================

COMMENT ON TABLE student_notification_preferences IS '학생 알림 설정';
COMMENT ON COLUMN student_notification_preferences.plan_start_enabled IS '학습 시작 알림 활성화';
COMMENT ON COLUMN student_notification_preferences.plan_complete_enabled IS '학습 완료 알림 활성화';
COMMENT ON COLUMN student_notification_preferences.daily_goal_achieved_enabled IS '일일 목표 달성 알림 활성화';
COMMENT ON COLUMN student_notification_preferences.weekly_report_enabled IS '주간 리포트 알림 활성화';
COMMENT ON COLUMN student_notification_preferences.plan_delay_enabled IS '플랜 지연 알림 활성화';
COMMENT ON COLUMN student_notification_preferences.plan_delay_threshold_minutes IS '플랜 지연 임계값 (분)';
COMMENT ON COLUMN student_notification_preferences.notification_time_start IS '알림 시작 시간';
COMMENT ON COLUMN student_notification_preferences.notification_time_end IS '알림 종료 시간';
COMMENT ON COLUMN student_notification_preferences.quiet_hours_enabled IS '방해 금지 시간 활성화';
COMMENT ON COLUMN student_notification_preferences.quiet_hours_start IS '방해 금지 시간 시작';
COMMENT ON COLUMN student_notification_preferences.quiet_hours_end IS '방해 금지 시간 종료';

