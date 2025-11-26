-- Migration: Remove School Code
-- Description: schools 테이블에서 school_code 컬럼 및 관련 인덱스 제거
-- Date: 2025-02-08

-- ============================================
-- 1. UNIQUE 인덱스 제거
-- ============================================

DROP INDEX IF EXISTS idx_schools_school_code_unique;

-- ============================================
-- 2. 일반 인덱스 제거
-- ============================================

DROP INDEX IF EXISTS idx_schools_school_code;

-- ============================================
-- 3. school_code 컬럼 제거
-- ============================================

ALTER TABLE schools
DROP COLUMN IF EXISTS school_code;

-- 참고: 컬럼이 제거되면 코멘트도 자동으로 제거됩니다.

