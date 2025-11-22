-- Migration: Add memo column to student_plan table
-- Description: 플랜 그룹별 메모를 저장하기 위한 컬럼 추가
-- Date: 2025-11-22
--
-- memo: 같은 plan_number를 가진 플랜 그룹에 대한 메모
-- 플랜 그룹 단위로 메모를 공유

-- ============================================
-- 1. student_plan 테이블에 memo 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- memo: 플랜 그룹 메모
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'memo'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN memo text;
    
    COMMENT ON COLUMN student_plan.memo IS '플랜 그룹별 메모. 같은 plan_number를 가진 플랜들은 이 메모를 공유합니다.';
  END IF;
END $$;

