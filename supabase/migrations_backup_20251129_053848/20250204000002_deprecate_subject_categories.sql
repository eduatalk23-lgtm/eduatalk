-- Migration: Deprecate subject_categories table
-- Description: subject_categories 테이블 제거 (더 이상 사용하지 않음)
-- Date: 2025-02-04

-- ============================================
-- 1. subject_categories 테이블 제거
-- ============================================

-- 1-1. 외래키 참조 확인
-- subjects 테이블이 subject_categories를 참조하는지 확인
DO $$
BEGIN
  -- subjects 테이블에 subject_category_id 컬럼이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' 
    AND column_name = 'subject_category_id'
  ) THEN
    -- 외래키 제약조건 제거
    ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_subject_category_id_fkey;
    
    -- 컬럼 제거
    ALTER TABLE subjects DROP COLUMN IF EXISTS subject_category_id;
  END IF;
END $$;

-- 1-2. subject_categories 테이블 제거
DROP TABLE IF EXISTS subject_categories CASCADE;

-- ============================================
-- 2. 코멘트 업데이트
-- ============================================

COMMENT ON TABLE subject_groups IS '교과 그룹 테이블 (전역 관리, 개정교육과정별) - subject_categories 대신 사용';
COMMENT ON TABLE subjects IS '과목 테이블 (전역 관리, 교과 그룹별)';

