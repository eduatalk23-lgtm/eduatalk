-- Migration: Add deleted_at column to student_plan for soft delete support
-- This enables cascade soft delete when a planner is deleted

BEGIN;

-- 1. student_plan 테이블에 deleted_at 컬럼 추가
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. 인덱스 추가 (삭제되지 않은 레코드 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_student_plan_deleted_at
ON student_plan (deleted_at)
WHERE deleted_at IS NULL;

-- 3. 복합 인덱스: student_id + deleted_at (학생별 활성 플랜 조회용)
CREATE INDEX IF NOT EXISTS idx_student_plan_student_active
ON student_plan (student_id, deleted_at)
WHERE deleted_at IS NULL;

-- 4. 복합 인덱스: plan_group_id + deleted_at (그룹별 활성 플랜 조회용)
CREATE INDEX IF NOT EXISTS idx_student_plan_group_active
ON student_plan (plan_group_id, deleted_at)
WHERE deleted_at IS NULL;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN student_plan.deleted_at IS
'소프트 삭제 타임스탬프. NULL이면 활성 상태, 값이 있으면 삭제된 상태.';

COMMIT;
