-- Migration: Fix student schema column issues
-- Description: student_goals.updated_at 추가 및 student_goal_progress 컬럼명 통일
-- Date: 2025-01-09

-- ============================================
-- 1. student_goals 테이블에 updated_at 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- updated_at 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_goals' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE student_goals 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- updated_at 자동 업데이트 함수 생성 (student_goals)
CREATE OR REPLACE FUNCTION update_student_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_goals' 
    AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_student_goals_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_student_goals_updated_at
      BEFORE UPDATE ON student_goals
      FOR EACH ROW
      EXECUTE FUNCTION update_student_goals_updated_at();
  END IF;
END $$;

-- ============================================
-- 2. student_goal_progress 테이블 컬럼명 통일
-- ============================================
-- 코드에서 created_at을 사용하므로, recorded_at을 created_at으로 변경

DO $$
BEGIN
  -- recorded_at이 있고 created_at이 없으면 이름 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_goal_progress' 
    AND column_name = 'recorded_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_goal_progress' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE student_goal_progress 
    RENAME COLUMN recorded_at TO created_at;
  END IF;
END $$;

-- ============================================
-- 3. student_plan 테이블 컬럼 확인 및 추가
-- ============================================

DO $$
BEGIN
  -- completed_amount 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'completed_amount'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN completed_amount integer;
  END IF;

  -- progress 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'progress'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN progress numeric CHECK (progress >= 0 AND progress <= 100);
  END IF;
END $$;

-- 코멘트 추가
COMMENT ON COLUMN student_goals.updated_at IS '목표 정보 마지막 업데이트 시간';
COMMENT ON COLUMN student_goal_progress.created_at IS '목표 진행률 기록 시간';
COMMENT ON COLUMN student_plan.completed_amount IS '완료된 학습량';
COMMENT ON COLUMN student_plan.progress IS '학습 진행률 (0-100)';

