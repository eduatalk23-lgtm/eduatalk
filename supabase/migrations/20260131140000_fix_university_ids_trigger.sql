-- ============================================================================
-- Fix: 잘못된 트리거 및 함수 제거
--
-- 문제: trigger_check_university_ids_length가 존재하지 않는 university_ids 컬럼 참조
-- 해결: 해당 트리거와 함수 삭제 (올바른 check_desired_university_ids_length 유지)
-- ============================================================================

-- 1. 잘못된 트리거 제거
DROP TRIGGER IF EXISTS trigger_check_university_ids_length ON student_career_goals;

-- 2. 잘못된 함수 제거
DROP FUNCTION IF EXISTS check_university_ids_length();

-- 3. 올바른 함수가 있는지 확인하고 없으면 생성
CREATE OR REPLACE FUNCTION check_desired_university_ids_length()
RETURNS TRIGGER AS $$
BEGIN
  IF array_length(NEW.desired_university_ids, 1) > 6 THEN
    RAISE EXCEPTION 'desired_university_ids cannot have more than 6 elements';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 참고: check_desired_university_ids_length 트리거는 이미 존재하므로 생성하지 않음
