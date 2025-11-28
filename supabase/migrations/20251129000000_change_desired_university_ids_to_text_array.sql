-- Migration: Change desired_university_ids from uuid[] to text[]
-- Description: 통합 ID 형식 (UNIV_14, SCHOOL_123 등)을 지원하기 위해 타입 변경
-- Date: 2025-11-29

-- ============================================
-- 1. 기존 컬럼 타입 변경
-- ============================================

-- 기존 uuid[] 데이터를 text[]로 변환
ALTER TABLE student_career_goals
ALTER COLUMN desired_university_ids TYPE text[] USING desired_university_ids::text[];

-- ============================================
-- 2. 코멘트 업데이트
-- ============================================

COMMENT ON COLUMN student_career_goals.desired_university_ids IS '희망 대학교 통합 ID 배열 (최대 3개, 형식: UNIV_14, SCHOOL_123 등)';

-- ============================================
-- 3. 기존 트리거 업데이트 (최대 3개 제한)
-- ============================================

-- 기존 트리거 함수가 있다면 그대로 유지 (배열 길이만 체크하므로 타입과 무관)
-- 트리거가 없다면 새로 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'check_desired_university_ids_length'
  ) THEN
    CREATE OR REPLACE FUNCTION check_desired_university_ids_length()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF array_length(NEW.desired_university_ids, 1) > 3 THEN
        RAISE EXCEPTION 'desired_university_ids 배열은 최대 3개까지만 선택할 수 있습니다.';
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER check_desired_university_ids_length
    BEFORE INSERT OR UPDATE ON student_career_goals
    FOR EACH ROW
    EXECUTE FUNCTION check_desired_university_ids_length();
  END IF;
END $$;

