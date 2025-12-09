-- ============================================
-- Migration: student_plan 상태 컬럼 추가/정리
-- Date: 2025-12-09
-- Phase: 1 (재조정 기능 - 안전한 최소 기능 고도화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R1-1]
-- ============================================

-- is_active 컬럼 추가 (없는 경우)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_plan' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 상태 컬럼 추가 (기존 데이터 마이그레이션 포함)
ALTER TABLE student_plan
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled'))
    DEFAULT 'pending';

-- 기존 데이터 마이그레이션
-- actual_end_time이 있으면 'completed'
-- actual_start_time이 있으면 'in_progress'
-- 둘 다 없으면 'pending'
UPDATE student_plan
SET status = CASE
  WHEN actual_end_time IS NOT NULL THEN 'completed'
  WHEN actual_start_time IS NOT NULL THEN 'in_progress'
  ELSE 'pending'
END
WHERE status IS NULL OR status = 'pending';

-- 인덱스 추가 (재조정 대상 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_student_plan_status 
  ON student_plan(status) 
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_student_plan_group_status 
  ON student_plan(plan_group_id, status, is_active) 
  WHERE status IN ('pending', 'in_progress') AND is_active = true;

-- 주석
COMMENT ON COLUMN student_plan.status IS 
'플랜 상태: pending(대기), in_progress(진행중), completed(완료), canceled(취소)';

