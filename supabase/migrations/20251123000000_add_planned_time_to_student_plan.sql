-- Migration: Add planned start_time and end_time to student_plan table
-- Description: 플랜 생성 시 계산된 계획 시간을 저장하기 위한 필드 추가 (HH:mm 형식)
-- Date: 2025-11-23
-- 
-- start_time, end_time: 플랜 생성 시 계산된 계획 시간 (HH:mm 형식, time 타입)
-- actual_start_time, actual_end_time: 실제 학습 시작/종료 시간 (timestamptz) - 이미 존재
--
-- 차이점:
-- - start_time, end_time: 플랜 그룹 생성 시 소요시간을 바탕으로 계산된 계획 시간
-- - actual_start_time, actual_end_time: 사용자가 실제로 학습을 시작/종료한 시간

-- ============================================
-- 1. student_plan 테이블에 계획 시간 필드 추가
-- ============================================

DO $$
BEGIN
  -- start_time: 플랜 생성 시 계산된 시작 시간 (HH:mm 형식)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'start_time'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN start_time time;
    
    COMMENT ON COLUMN student_plan.start_time IS '플랜 생성 시 계산된 계획 시작 시간 (HH:mm 형식). 플랜 그룹 생성 시 소요시간을 바탕으로 계산된 시간';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_start_time 
    ON student_plan(start_time) 
    WHERE start_time IS NOT NULL;
  END IF;

  -- end_time: 플랜 생성 시 계산된 종료 시간 (HH:mm 형식)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'end_time'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN end_time time;
    
    COMMENT ON COLUMN student_plan.end_time IS '플랜 생성 시 계산된 계획 종료 시간 (HH:mm 형식). 플랜 그룹 생성 시 소요시간을 바탕으로 계산된 시간';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_end_time 
    ON student_plan(end_time) 
    WHERE end_time IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2. 날짜 + 시간 조합 인덱스 추가 (캘린더 조회 최적화)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_plan_date_time 
ON student_plan(plan_date, start_time, end_time) 
WHERE start_time IS NOT NULL AND end_time IS NOT NULL;

