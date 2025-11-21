-- Migration: Add plan_number to student_plan table
-- Description: 플랜 그룹 내에서 논리적 플랜을 식별하기 위한 번호 추가
-- Date: 2025-11-25
--
-- plan_number: 플랜 그룹 내에서의 논리적 플랜 번호
-- 같은 플랜이 여러 블록에 걸쳐 쪼개진 경우 동일한 번호 사용
-- 학습 플랜에만 부여 (학원일정, 이동시간, 점심시간, 자율학습은 null)

-- ============================================
-- 1. student_plan 테이블에 plan_number 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- plan_number: 플랜 그룹 내 논리적 플랜 번호
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'plan_number'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN plan_number integer;
    
    COMMENT ON COLUMN student_plan.plan_number IS '플랜 그룹 내에서의 논리적 플랜 번호. 같은 플랜이 여러 블록에 걸쳐 쪼개진 경우 동일한 번호 사용. 학습 플랜에만 부여 (학원일정, 이동시간, 점심시간, 자율학습은 null)';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_plan_number 
    ON student_plan(plan_number) 
    WHERE plan_number IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2. 복합 인덱스 추가 (조회 성능 최적화)
-- ============================================

-- 플랜 그룹 + 플랜 번호 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_group_plan_number 
ON student_plan(plan_group_id, plan_number) 
WHERE plan_group_id IS NOT NULL AND plan_number IS NOT NULL;

-- 날짜 + 플랜 번호 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_date_plan_number 
ON student_plan(plan_date, plan_number) 
WHERE plan_number IS NOT NULL;

