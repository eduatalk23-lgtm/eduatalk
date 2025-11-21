-- Migration: Add timing fields to student_plan table
-- Description: 플랜별 시간 측정을 위한 필드 추가 (시작/종료 시간, 소요시간, 일시정지 정보)
-- Date: 2025-01-22

-- ============================================
-- 1. student_plan 테이블에 시간 측정 필드 추가
-- ============================================

DO $$
BEGIN
  -- actual_start_time: 실제 학습 시작 시간
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'actual_start_time'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN actual_start_time timestamptz;
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_actual_start_time 
    ON student_plan(actual_start_time) 
    WHERE actual_start_time IS NOT NULL;
  END IF;

  -- actual_end_time: 실제 학습 종료 시간
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'actual_end_time'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN actual_end_time timestamptz;
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_actual_end_time 
    ON student_plan(actual_end_time) 
    WHERE actual_end_time IS NOT NULL;
  END IF;

  -- total_duration_seconds: 총 소요 시간 (초 단위)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'total_duration_seconds'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN total_duration_seconds integer;
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_total_duration 
    ON student_plan(total_duration_seconds) 
    WHERE total_duration_seconds IS NOT NULL;
  END IF;

  -- paused_duration_seconds: 일시정지된 총 시간 (초 단위)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'paused_duration_seconds'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN paused_duration_seconds integer DEFAULT 0;
  END IF;

  -- pause_count: 일시정지 횟수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'pause_count'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN pause_count integer DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 2. student_study_sessions 테이블 확장 (일시정지 정보)
-- ============================================

DO $$
BEGIN
  -- paused_at: 일시정지 시작 시간
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_study_sessions' 
    AND column_name = 'paused_at'
  ) THEN
    ALTER TABLE student_study_sessions 
    ADD COLUMN paused_at timestamptz;
  END IF;

  -- resumed_at: 재개 시간
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_study_sessions' 
    AND column_name = 'resumed_at'
  ) THEN
    ALTER TABLE student_study_sessions 
    ADD COLUMN resumed_at timestamptz;
  END IF;

  -- paused_duration_seconds: 이 세션에서 일시정지된 시간 (초 단위)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_study_sessions' 
    AND column_name = 'paused_duration_seconds'
  ) THEN
    ALTER TABLE student_study_sessions 
    ADD COLUMN paused_duration_seconds integer DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN student_plan.actual_start_time IS '실제 학습 시작 시간';
COMMENT ON COLUMN student_plan.actual_end_time IS '실제 학습 종료 시간';
COMMENT ON COLUMN student_plan.total_duration_seconds IS '총 소요 시간 (초 단위, actual_end_time - actual_start_time)';
COMMENT ON COLUMN student_plan.paused_duration_seconds IS '일시정지된 총 시간 (초 단위)';
COMMENT ON COLUMN student_plan.pause_count IS '일시정지 횟수';

COMMENT ON COLUMN student_study_sessions.paused_at IS '일시정지 시작 시간';
COMMENT ON COLUMN student_study_sessions.resumed_at IS '재개 시간';
COMMENT ON COLUMN student_study_sessions.paused_duration_seconds IS '이 세션에서 일시정지된 시간 (초 단위)';

