-- Migration: Remove default_subject_type from subject_groups
-- Description: subject_groups 테이블에서 default_subject_type 컬럼 제거
-- Date: 2025-02-05

-- ============================================
-- 1. subject_groups 테이블에서 default_subject_type 컬럼 제거
-- ============================================

ALTER TABLE subject_groups
DROP COLUMN IF EXISTS default_subject_type;

-- ============================================
-- 2. 코멘트 업데이트
-- ============================================

COMMENT ON TABLE subject_groups IS '교과 그룹 테이블 (전역 관리, 개정교육과정별)';

