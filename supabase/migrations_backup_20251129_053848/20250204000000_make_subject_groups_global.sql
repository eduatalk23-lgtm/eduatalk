-- Migration: Make subject_groups and subjects global
-- Description: subject_groups와 subjects를 전역 관리로 변경 (tenant_id 제거, curriculum_revision_id 추가)
-- Date: 2025-02-04

-- ============================================
-- 1. subject_groups 테이블 스키마 변경
-- ============================================

-- 1-1. curriculum_revision_id 컬럼 추가 (NULL 허용, 나중에 데이터 마이그레이션에서 채움)
ALTER TABLE subject_groups
ADD COLUMN IF NOT EXISTS curriculum_revision_id uuid REFERENCES curriculum_revisions(id) ON DELETE RESTRICT;

-- 1-2. 기존 UNIQUE 제약조건 제거 (tenant_id, name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subject_groups_tenant_id_name_key'
  ) THEN
    ALTER TABLE subject_groups DROP CONSTRAINT subject_groups_tenant_id_name_key;
  END IF;
END $$;

-- 1-3. 새로운 UNIQUE 제약조건 추가 (curriculum_revision_id, name)
-- 개정교육과정별로 동일한 교과 이름이 있을 수 있으므로 (curriculum_revision_id, name)으로 설정
CREATE UNIQUE INDEX IF NOT EXISTS subject_groups_curriculum_revision_id_name_key 
ON subject_groups(curriculum_revision_id, name) 
WHERE curriculum_revision_id IS NOT NULL;

-- 1-4. tenant_id 컬럼 제거 (데이터 마이그레이션 후 실행)
-- 주의: 이 단계는 데이터 마이그레이션 후 별도 마이그레이션에서 실행

-- ============================================
-- 2. subjects 테이블 스키마 변경
-- ============================================

-- 2-1. 기존 UNIQUE 제약조건 제거 (tenant_id, subject_group_id, name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subjects_tenant_id_subject_group_id_name_key'
  ) THEN
    ALTER TABLE subjects DROP CONSTRAINT subjects_tenant_id_subject_group_id_name_key;
  END IF;
END $$;

-- 2-2. 새로운 UNIQUE 제약조건 추가 (subject_group_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS subjects_subject_group_id_name_key 
ON subjects(subject_group_id, name);

-- 2-3. tenant_id 컬럼 제거 (데이터 마이그레이션 후 실행)
-- 주의: 이 단계는 데이터 마이그레이션 후 별도 마이그레이션에서 실행

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN subject_groups.curriculum_revision_id IS '개정교육과정 ID (전역 관리)';
COMMENT ON TABLE subject_groups IS '교과 그룹 테이블 (전역 관리, 개정교육과정별)';
COMMENT ON TABLE subjects IS '과목 테이블 (전역 관리, 교과 그룹별)';

