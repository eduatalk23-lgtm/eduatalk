-- Migration: Add subject_type fields to subject_groups and subjects
-- Description: 교과 그룹과 과목에 과목 유형 필드 추가
-- Date: 2025-01-30

-- ============================================
-- 1. 교과 그룹에 기본 과목 유형 필드 추가
-- ============================================

ALTER TABLE subject_groups 
  ADD COLUMN IF NOT EXISTS default_subject_type text;

-- 기본 교과의 기본 과목 유형 설정
UPDATE subject_groups 
SET default_subject_type = '공통'
WHERE name IN ('국어', '수학', '영어', '한국사', '과학');

-- ============================================
-- 2. 과목에 과목 유형 필드 추가 (선택적, 과목별로 다를 수 있음)
-- ============================================

ALTER TABLE subjects 
  ADD COLUMN IF NOT EXISTS subject_type text;

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN subject_groups.default_subject_type IS '교과 그룹의 기본 과목 유형 (공통, 일반선택, 진로선택)';
COMMENT ON COLUMN subjects.subject_type IS '과목별 과목 유형 (null이면 교과 그룹의 default_subject_type 사용)';

