-- Migration: Remove display_order from education metadata tables
-- Description: 
--   교육과정/교과/과목/과목구분 테이블에서 display_order 컬럼 제거
--   - curriculum_revisions
--   - subject_groups
--   - subjects
--   - subject_types
-- Date: 2025-01-27

-- ============================================
-- 1. curriculum_revisions 테이블에서 display_order 제거
-- ============================================

-- 1-1. 인덱스 제거 (있다면)
DROP INDEX IF EXISTS idx_curriculum_revisions_display_order;

-- 1-2. 컬럼 제거
ALTER TABLE curriculum_revisions
DROP COLUMN IF EXISTS display_order;

-- 1-3. 코멘트 제거
COMMENT ON COLUMN curriculum_revisions.display_order IS NULL;

-- ============================================
-- 2. subject_groups 테이블에서 display_order 제거
-- ============================================

-- 2-1. 인덱스 제거 (있다면)
DROP INDEX IF EXISTS idx_subject_groups_display_order;

-- 2-2. 컬럼 제거
ALTER TABLE subject_groups
DROP COLUMN IF EXISTS display_order;

-- 2-3. 코멘트 제거
COMMENT ON COLUMN subject_groups.display_order IS NULL;

-- ============================================
-- 3. subjects 테이블에서 display_order 제거
-- ============================================

-- 3-1. 인덱스 제거 (있다면)
DROP INDEX IF EXISTS idx_subjects_display_order;

-- 3-2. 컬럼 제거
ALTER TABLE subjects
DROP COLUMN IF EXISTS display_order;

-- 3-3. 코멘트 제거
COMMENT ON COLUMN subjects.display_order IS NULL;

-- ============================================
-- 4. subject_types 테이블에서 display_order 제거
-- ============================================

-- 4-1. 인덱스 제거
DROP INDEX IF EXISTS idx_subject_types_display_order;

-- 4-2. 컬럼 제거
ALTER TABLE subject_types
DROP COLUMN IF EXISTS display_order;

-- 4-3. 코멘트 제거
COMMENT ON COLUMN subject_types.display_order IS NULL;

