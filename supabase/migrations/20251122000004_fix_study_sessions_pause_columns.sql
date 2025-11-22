-- Migration: Fix student_study_sessions pause columns
-- Description: student_study_sessions 테이블에 paused_at, resumed_at, paused_duration_seconds 컬럼이 없으면 추가
-- Date: 2025-11-22

-- ============================================
-- student_study_sessions 테이블에 일시정지 관련 컬럼 추가
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
    
    COMMENT ON COLUMN student_study_sessions.paused_at IS '일시정지 시작 시간';
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
    
    COMMENT ON COLUMN student_study_sessions.resumed_at IS '재개 시간';
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
    
    COMMENT ON COLUMN student_study_sessions.paused_duration_seconds IS '이 세션에서 일시정지된 시간 (초 단위)';
  END IF;
END $$;

