-- Migration: Add sequence to student_plan table
-- Description: 플랜 그룹 내에서 같은 콘텐츠의 회차 정보 추가
-- Date: 2025-11-26
--
-- sequence: 같은 content_id를 가진 플랜들 중에서의 회차 번호
-- 같은 plan_number를 가진 플랜들은 같은 회차를 가짐
-- 학습 플랜에만 부여 (학원일정, 이동시간, 점심시간, 자율학습은 null)

-- ============================================
-- 1. student_plan 테이블에 sequence 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- sequence: 플랜 그룹 내에서 같은 콘텐츠의 회차 번호
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'sequence'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN sequence integer;
    
    COMMENT ON COLUMN student_plan.sequence IS '플랜 그룹 내에서 같은 content_id를 가진 플랜들 중에서의 회차 번호. 같은 plan_number를 가진 플랜들은 같은 회차를 가짐. 학습 플랜에만 부여 (학원일정, 이동시간, 점심시간, 자율학습은 null)';
    
    CREATE INDEX IF NOT EXISTS idx_student_plan_sequence 
    ON student_plan(sequence) 
    WHERE sequence IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2. 복합 인덱스 추가 (조회 성능 최적화)
-- ============================================

-- 플랜 그룹 + 콘텐츠 + 회차 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_group_content_sequence 
ON student_plan(plan_group_id, content_id, sequence) 
WHERE plan_group_id IS NOT NULL AND content_id IS NOT NULL AND sequence IS NOT NULL;

-- 콘텐츠 + 회차 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_content_sequence 
ON student_plan(content_id, sequence) 
WHERE content_id IS NOT NULL AND sequence IS NOT NULL;

