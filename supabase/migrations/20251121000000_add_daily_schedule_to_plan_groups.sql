-- Migration: Add daily_schedule cache to plan_groups
-- Description: 플랜 그룹에 dailySchedule을 JSONB로 저장하여 매번 계산하지 않도록 개선
-- Date: 2025-01-21

-- ============================================
-- 1. plan_groups에 daily_schedule JSONB 컬럼 추가
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_groups' 
    AND column_name = 'daily_schedule'
  ) THEN
    ALTER TABLE plan_groups 
    ADD COLUMN daily_schedule jsonb;
    
    COMMENT ON COLUMN plan_groups.daily_schedule IS '일별 스케줄 정보 (JSONB). calculateAvailableDates 결과를 캐싱하여 매번 계산하지 않도록 저장';
  END IF;
END $$;

-- ============================================
-- 2. 인덱스 추가 (JSONB 쿼리 최적화)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_plan_groups_daily_schedule 
ON plan_groups USING gin (daily_schedule);

