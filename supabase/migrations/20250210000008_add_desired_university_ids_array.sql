-- Migration: Add desired_university_ids array field
-- Description: 희망 대학교를 배열 필드로 변경하여 다중선택 지원 (최대 3개)
-- Date: 2025-02-10

-- ============================================
-- 1. desired_university_ids 배열 필드 추가
-- ============================================

ALTER TABLE student_career_goals
ADD COLUMN IF NOT EXISTS desired_university_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN student_career_goals.desired_university_ids IS '희망 대학교 ID 배열 (최대 3개, FK → schools.id)';

-- ============================================
-- 2. 기존 데이터 마이그레이션
-- ============================================

-- 기존 desired_university_1_id, desired_university_2_id, desired_university_3_id를 배열로 변환
UPDATE student_career_goals
SET desired_university_ids = ARRAY_REMOVE(
  ARRAY[
    desired_university_1_id,
    desired_university_2_id,
    desired_university_3_id
  ],
  NULL
)
WHERE desired_university_1_id IS NOT NULL
   OR desired_university_2_id IS NOT NULL
   OR desired_university_3_id IS NOT NULL;

-- ============================================
-- 3. 배열 필드 인덱스 생성 (GIN 인덱스)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_career_goals_university_ids 
ON student_career_goals USING GIN (desired_university_ids);

-- ============================================
-- 4. 배열 길이 제약조건 추가 (최대 3개)
-- ============================================

-- 배열 길이를 체크하는 함수 생성
CREATE OR REPLACE FUNCTION check_university_ids_length()
RETURNS TRIGGER AS $$
BEGIN
  IF array_length(NEW.desired_university_ids, 1) > 3 THEN
    RAISE EXCEPTION 'desired_university_ids 배열은 최대 3개까지만 선택할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_check_university_ids_length ON student_career_goals;
CREATE TRIGGER trigger_check_university_ids_length
  BEFORE INSERT OR UPDATE ON student_career_goals
  FOR EACH ROW
  EXECUTE FUNCTION check_university_ids_length();

