-- Migration: Add is_active column to students table
-- Description: 학생 계정 활성화/비활성화 및 삭제 기능을 위한 컬럼 추가
-- Date: 2025-01-22

-- ============================================
-- 1. students 테이블에 is_active 컬럼 추가
-- ============================================

-- is_active 컬럼 추가 (기본값: true)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- 인덱스 추가 (비활성화된 학생 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);

-- 기존 데이터는 모두 활성화 상태로 설정
UPDATE students SET is_active = true WHERE is_active IS NULL;

-- 코멘트 추가
COMMENT ON COLUMN students.is_active IS '학생 계정 활성화 여부 (true: 활성, false: 비활성화)';

