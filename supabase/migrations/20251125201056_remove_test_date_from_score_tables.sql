-- Migration: Remove test_date column from score tables
-- Description: student_school_scores와 student_mock_scores 테이블에서 test_date 컬럼 제거
-- Date: 2025-11-25
--
-- 이 마이그레이션은 성적 테이블에서 시험일(test_date) 필드를 제거합니다.
-- 기존 데이터의 test_date 값도 함께 삭제됩니다.

-- ============================================
-- 1. 기존 데이터 확인 (참고용)
-- ============================================

-- 내신 성적 테이블의 test_date 데이터 확인
-- SELECT COUNT(*) as total_records, 
--        COUNT(test_date) as records_with_test_date
-- FROM student_school_scores;

-- 모의고사 성적 테이블의 test_date 데이터 확인
-- SELECT COUNT(*) as total_records, 
--        COUNT(test_date) as records_with_test_date
-- FROM student_mock_scores;

-- ============================================
-- 2. 내신 성적 테이블에서 test_date 컬럼 제거
-- ============================================

ALTER TABLE student_school_scores
DROP COLUMN IF EXISTS test_date;

-- ============================================
-- 3. 모의고사 성적 테이블에서 test_date 컬럼 제거
-- ============================================

ALTER TABLE student_mock_scores
DROP COLUMN IF EXISTS test_date;

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON TABLE student_school_scores IS '내신 성적 테이블. 시험일(test_date) 필드는 제거되었습니다.';
COMMENT ON TABLE student_mock_scores IS '모의고사 성적 테이블. 시험일(test_date) 필드는 제거되었습니다.';

