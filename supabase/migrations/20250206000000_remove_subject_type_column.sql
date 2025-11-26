-- Migration: Remove subject_type column from subjects table
-- Description: subjects 테이블에서 subject_type 컬럼 제거 (subject_type_id만 사용)
-- Date: 2025-02-06

-- ============================================
-- 1. subjects 테이블에서 subject_type 컬럼 제거
-- ============================================

-- 주의: 기존 데이터는 이미 subject_type_id로 마이그레이션되었으므로 안전하게 제거 가능
ALTER TABLE subjects DROP COLUMN IF EXISTS subject_type;

-- ============================================
-- 2. 코멘트 업데이트
-- ============================================

COMMENT ON TABLE subjects IS '과목 테이블 (전역 관리, 교과 그룹별)';
COMMENT ON COLUMN subjects.subject_type_id IS '과목구분 ID (FK → subject_types, nullable)';

