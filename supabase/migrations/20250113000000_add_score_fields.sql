-- Migration: Add new fields to school and mock scores tables
-- Description: 내신 성적에 생기부 필드 추가, 모의고사에 표준점수 추가
-- Date: 2025-01-13

-- ============================================
-- 1. 내신 성적 테이블에 새 필드 추가
-- ============================================

ALTER TABLE student_school_scores
  ADD COLUMN IF NOT EXISTS credit_hours numeric CHECK (credit_hours > 0),
  ADD COLUMN IF NOT EXISTS subject_average numeric,
  ADD COLUMN IF NOT EXISTS standard_deviation numeric,
  ADD COLUMN IF NOT EXISTS total_students integer CHECK (total_students > 0),
  ADD COLUMN IF NOT EXISTS rank_grade integer CHECK (rank_grade >= 1 AND rank_grade <= 9);

-- 원점수를 필수로 변경 (기존 데이터는 NULL 허용, 새 데이터는 필수)
-- ALTER TABLE student_school_scores ALTER COLUMN raw_score SET NOT NULL; -- 기존 데이터 고려하여 주석 처리

-- 코멘트 추가
COMMENT ON COLUMN student_school_scores.credit_hours IS '학점수';
COMMENT ON COLUMN student_school_scores.subject_average IS '과목평균';
COMMENT ON COLUMN student_school_scores.standard_deviation IS '표준편차';
COMMENT ON COLUMN student_school_scores.total_students IS '수강자수';
COMMENT ON COLUMN student_school_scores.rank_grade IS '석차등급 (1~9등급)';

-- ============================================
-- 2. 모의고사 성적 테이블에 표준점수 필드 추가
-- ============================================

ALTER TABLE student_mock_scores
  ADD COLUMN IF NOT EXISTS standard_score numeric;

-- 코멘트 추가
COMMENT ON COLUMN student_mock_scores.standard_score IS '표준점수';

-- ============================================
-- 3. 인덱스 추가 (필요한 경우)
-- ============================================

-- 성적 조회 성능 향상을 위한 인덱스는 이미 존재하므로 추가 인덱스는 필요시에만 추가

