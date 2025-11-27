-- Migration: Add risk_evaluation to student_history event_type constraint
-- Description: student_history 테이블의 event_type CHECK 제약 조건에 risk_evaluation 추가
-- Date: 2025-11-27

-- ============================================
-- 1. 기존 제약 조건 확인 및 수정
-- ============================================

-- student_history_event_type_check 제약 조건이 있는지 확인하고 수정
DO $$
BEGIN
  -- 제약 조건이 존재하는 경우 삭제
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_history_event_type_check'
  ) THEN
    ALTER TABLE student_history DROP CONSTRAINT student_history_event_type_check;
  END IF;
END $$;

-- 새로운 제약 조건 추가 (risk_evaluation 포함)
ALTER TABLE student_history
ADD CONSTRAINT student_history_event_type_check 
CHECK (
  event_type IN (
    'plan_completed',
    'study_session',
    'goal_progress',
    'goal_created',
    'goal_completed',
    'score_added',
    'score_updated',
    'content_progress',
    'auto_schedule_generated',
    'risk_evaluation'
  )
);

COMMENT ON CONSTRAINT student_history_event_type_check ON student_history IS 
  '학생 히스토리 이벤트 타입 제약 조건 (학습 활동 및 위험 평가 포함)';

