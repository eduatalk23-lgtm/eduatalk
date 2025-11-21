-- Migration: Add plan metadata fields to student_plan table
-- Description: 플랜 그룹 생성 시 날짜 유형, 주차 정보, 상태뱃지 정보를 저장하기 위한 필드 추가
-- Date: 2025-11-24
--
-- 추가 필드:
-- - day_type: 날짜 유형 (학습일/복습일/지정휴일/휴가/개인일정)
-- - week: 주차 번호 (1주차, 2주차, ...)
-- - day: 해당 주의 일차 (1일, 2일, ...)
-- - is_partial: (일부) 표시 여부
-- - is_continued: [이어서] 표시 여부

-- ============================================
-- 1. student_plan 테이블에 메타데이터 필드 추가
-- ============================================

DO $$
BEGIN
  -- day_type: 날짜 유형
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'day_type'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN day_type text CHECK (day_type IN ('학습일', '복습일', '지정휴일', '휴가', '개인일정'));
    
    COMMENT ON COLUMN student_plan.day_type IS '날짜 유형. 학습일/복습일/지정휴일/휴가/개인일정. 플랜 그룹의 스케줄러 타입에 따라 계산됨';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_day_type 
    ON student_plan(day_type) 
    WHERE day_type IS NOT NULL;
  END IF;

  -- week: 주차 번호
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'week'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN week integer;
    
    COMMENT ON COLUMN student_plan.week IS '주차 번호 (1주차, 2주차, ...). period_start 기준으로 계산됨. 스케줄러 타입에 따라 계산 방법이 다름';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_week 
    ON student_plan(week) 
    WHERE week IS NOT NULL;
  END IF;

  -- day: 해당 주의 일차
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'day'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN day integer;
    
    COMMENT ON COLUMN student_plan.day IS '해당 주의 일차 (1일, 2일, ...). 주차 내에서의 순서';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_day 
    ON student_plan(day) 
    WHERE day IS NOT NULL;
  END IF;

  -- is_partial: (일부) 표시 여부
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'is_partial'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN is_partial boolean DEFAULT false;
    
    COMMENT ON COLUMN student_plan.is_partial IS '플랜이 일부만 배치된 경우 (일부) 표시 여부. 하나의 플랜이 여러 블록에 걸쳐 쪼개진 경우 사용';
  END IF;

  -- is_continued: [이어서] 표시 여부
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'is_continued'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN is_continued boolean DEFAULT false;
    
    COMMENT ON COLUMN student_plan.is_continued IS '이전 블록에서 이어서 배치된 경우 [이어서] 표시 여부. 하나의 플랜이 여러 블록에 걸쳐 쪼개진 경우 사용';
  END IF;
END $$;

-- ============================================
-- 2. 복합 인덱스 추가 (조회 성능 최적화)
-- ============================================

-- 주차별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_week_day 
ON student_plan(week, day) 
WHERE week IS NOT NULL AND day IS NOT NULL;

-- 날짜 유형별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_date_day_type 
ON student_plan(plan_date, day_type) 
WHERE day_type IS NOT NULL;

-- 플랜 그룹 + 주차 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_group_week 
ON student_plan(plan_group_id, week) 
WHERE plan_group_id IS NOT NULL AND week IS NOT NULL;

