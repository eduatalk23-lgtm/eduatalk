-- ============================================
-- Migration: student_plan version_group_id 컬럼 추가
-- Date: 2025-12-09
-- Phase: 2 (재조정 기능 - 데이터 모델 및 롤백 정교화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R2-1]
-- ============================================

-- version_group_id 컬럼 추가
ALTER TABLE student_plan
  ADD COLUMN IF NOT EXISTS version_group_id UUID;

-- version 컬럼 추가 (없는 경우)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_plan' AND column_name = 'version'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- 기존 플랜: version_group_id = id (자기 자신), version = 1
UPDATE student_plan
SET 
  version_group_id = id,
  version = COALESCE(version, 1)
WHERE version_group_id IS NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_student_plan_version_group 
  ON student_plan(version_group_id, version);

CREATE INDEX IF NOT EXISTS idx_student_plan_version_active 
  ON student_plan(version_group_id, is_active) 
  WHERE is_active = true;

-- 주석
COMMENT ON COLUMN student_plan.version_group_id IS 
'버전 그룹 ID - 같은 플랜의 여러 버전을 그룹화하는 ID (최초 버전의 플랜 ID)';

COMMENT ON COLUMN student_plan.version IS 
'플랜 버전 번호 - 같은 version_group_id 내에서의 버전 (1부터 시작)';

