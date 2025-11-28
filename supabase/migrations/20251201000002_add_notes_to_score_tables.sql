-- Migration: Add notes column to score tables for dummy data tagging
-- Description: 
--   student_internal_scores와 student_mock_scores에 notes 컬럼 추가
--   students 테이블에 memo 컬럼 추가
--   더미 데이터를 쉽게 식별하고 삭제하기 위한 태깅 용도
-- Date: 2025-12-01

-- ============================================
-- 1. students 테이블에 memo 컬럼 추가
-- ============================================

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS memo text;

COMMENT ON COLUMN public.students.memo IS '학생 메모 (더미 데이터 태깅용)';

-- ============================================
-- 2. student_internal_scores에 notes 컬럼 추가
-- ============================================

ALTER TABLE public.student_internal_scores
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.student_internal_scores.notes IS '비고 (더미 데이터 태깅용)';

-- ============================================
-- 3. student_mock_scores에 notes 컬럼 추가
-- ============================================

ALTER TABLE public.student_mock_scores
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.student_mock_scores.notes IS '비고 (더미 데이터 태깅용)';

