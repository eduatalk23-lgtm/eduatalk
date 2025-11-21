-- Migration: Add scheduler_options column to plan_groups
-- Description: 플랜 그룹에 scheduler_options JSONB 컬럼 추가 (시간 설정 등 스케줄러 옵션 저장)
-- Date: 2025-01-22

-- ============================================
-- 1. plan_groups에 scheduler_options JSONB 컬럼 추가
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_groups' 
    AND column_name = 'scheduler_options'
  ) THEN
    ALTER TABLE plan_groups 
    ADD COLUMN scheduler_options jsonb;
    
    COMMENT ON COLUMN plan_groups.scheduler_options IS '스케줄러 옵션 (JSONB). 시간 설정, 자율학습 시간 배정 옵션 등을 저장';
  END IF;
END $$;

-- ============================================
-- 2. 인덱스 추가 (JSONB 쿼리 최적화)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_plan_groups_scheduler_options 
ON plan_groups USING gin (scheduler_options);

