-- Migration: Remove deprecated university fields from student_career_goals
-- Description: student_career_goals 테이블에서 deprecated된 desired_university_1~3_id 필드 제거
-- Date: 2025-02-10
-- 
-- 주의: desired_university_ids 배열로 이미 마이그레이션되었으므로 안전하게 제거 가능

-- ============================================
-- 1. 기존 데이터 확인 (desired_university_ids 배열이 비어있고 deprecated 필드에 값이 있는 경우)
-- ============================================

-- 마이그레이션 스크립트가 이미 실행되어 desired_university_ids로 변환되었는지 확인
-- 만약 변환이 안 된 데이터가 있다면 다시 변환
UPDATE student_career_goals
SET desired_university_ids = ARRAY_REMOVE(
  ARRAY[
    desired_university_1_id,
    desired_university_2_id,
    desired_university_3_id
  ],
  NULL
)
WHERE (desired_university_ids IS NULL OR array_length(desired_university_ids, 1) = 0)
  AND (desired_university_1_id IS NOT NULL
   OR desired_university_2_id IS NOT NULL
   OR desired_university_3_id IS NOT NULL);

-- ============================================
-- 2. deprecated 필드 제거
-- ============================================

-- desired_university_1_id 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_career_goals' AND column_name = 'desired_university_1_id'
  ) THEN
    ALTER TABLE student_career_goals DROP COLUMN desired_university_1_id;
  END IF;
END $$;

-- desired_university_2_id 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_career_goals' AND column_name = 'desired_university_2_id'
  ) THEN
    ALTER TABLE student_career_goals DROP COLUMN desired_university_2_id;
  END IF;
END $$;

-- desired_university_3_id 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_career_goals' AND column_name = 'desired_university_3_id'
  ) THEN
    ALTER TABLE student_career_goals DROP COLUMN desired_university_3_id;
  END IF;
END $$;

-- ============================================
-- 3. 관련 인덱스 제거
-- ============================================

-- deprecated 필드에 대한 인덱스 제거
DROP INDEX IF EXISTS idx_student_career_goals_university_1;
DROP INDEX IF EXISTS idx_student_career_goals_university_2;
DROP INDEX IF EXISTS idx_student_career_goals_university_3;

-- ============================================
-- 4. 코멘트 업데이트
-- ============================================

COMMENT ON COLUMN student_career_goals.desired_university_ids IS '희망 대학교 ID 배열 (최대 3개, FK → schools.id) - desired_university_1~3_id 필드를 대체';









