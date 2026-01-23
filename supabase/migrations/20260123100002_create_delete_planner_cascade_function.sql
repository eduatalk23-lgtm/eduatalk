-- Migration: Create delete_planner_cascade RPC function
-- Atomic transaction for cascade soft delete of planner and related data

BEGIN;

-- 플래너 Cascade 삭제 결과 타입
DROP TYPE IF EXISTS delete_planner_result CASCADE;
CREATE TYPE delete_planner_result AS (
  success BOOLEAN,
  planner_id UUID,
  deleted_plan_groups_count INTEGER,
  deleted_student_plans_count INTEGER,
  deleted_exclusions_count INTEGER,
  deleted_academy_schedules_count INTEGER,
  error TEXT,
  error_code TEXT
);

-- 플래너 Cascade 삭제 함수
CREATE OR REPLACE FUNCTION delete_planner_cascade(
  p_planner_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS delete_planner_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result delete_planner_result;
  v_now TIMESTAMPTZ := NOW();
  v_plan_group_ids UUID[];
  v_deleted_plans_count INTEGER := 0;
  v_deleted_groups_count INTEGER := 0;
  v_deleted_exclusions_count INTEGER := 0;
  v_deleted_schedules_count INTEGER := 0;
  v_planner_exists BOOLEAN;
BEGIN
  -- 초기화
  v_result.success := FALSE;
  v_result.planner_id := p_planner_id;
  v_result.deleted_plan_groups_count := 0;
  v_result.deleted_student_plans_count := 0;
  v_result.deleted_exclusions_count := 0;
  v_result.deleted_academy_schedules_count := 0;

  -- 1. 플래너 존재 여부 확인
  SELECT EXISTS(
    SELECT 1 FROM planners
    WHERE id = p_planner_id
      AND deleted_at IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  ) INTO v_planner_exists;

  IF NOT v_planner_exists THEN
    v_result.error := '플래너를 찾을 수 없습니다.';
    v_result.error_code := 'NOT_FOUND';
    RETURN v_result;
  END IF;

  -- 2. 하위 plan_groups ID 수집
  SELECT ARRAY_AGG(id) INTO v_plan_group_ids
  FROM plan_groups
  WHERE planner_id = p_planner_id
    AND deleted_at IS NULL;

  -- 3. student_plan 소프트 삭제 (plan_group_id로 연결된 플랜들)
  IF v_plan_group_ids IS NOT NULL AND array_length(v_plan_group_ids, 1) > 0 THEN
    WITH updated AS (
      UPDATE student_plan
      SET deleted_at = v_now
      WHERE plan_group_id = ANY(v_plan_group_ids)
        AND deleted_at IS NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_plans_count FROM updated;
  END IF;

  -- 4. plan_groups 소프트 삭제
  WITH updated AS (
    UPDATE plan_groups
    SET deleted_at = v_now
    WHERE planner_id = p_planner_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_groups_count FROM updated;

  -- 5. planner_exclusions 하드 삭제 (설정 데이터)
  WITH deleted AS (
    DELETE FROM planner_exclusions
    WHERE planner_id = p_planner_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_exclusions_count FROM deleted;

  -- 6. planner_academy_schedules 하드 삭제 (설정 데이터)
  WITH deleted AS (
    DELETE FROM planner_academy_schedules
    WHERE planner_id = p_planner_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_schedules_count FROM deleted;

  -- 7. planners 소프트 삭제
  UPDATE planners
  SET deleted_at = v_now
  WHERE id = p_planner_id
    AND deleted_at IS NULL;

  -- 결과 설정
  v_result.success := TRUE;
  v_result.deleted_plan_groups_count := v_deleted_groups_count;
  v_result.deleted_student_plans_count := v_deleted_plans_count;
  v_result.deleted_exclusions_count := v_deleted_exclusions_count;
  v_result.deleted_academy_schedules_count := v_deleted_schedules_count;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result.success := FALSE;
    v_result.error := SQLERRM;
    v_result.error_code := SQLSTATE;
    RETURN v_result;
END;
$$;

-- 함수 코멘트
COMMENT ON FUNCTION delete_planner_cascade IS
'플래너와 하위 데이터를 원자적으로 Cascade 삭제합니다.
- student_plan: 소프트 삭제
- plan_groups: 소프트 삭제
- planner_exclusions: 하드 삭제
- planner_academy_schedules: 하드 삭제
- planners: 소프트 삭제
부분 실패 시 자동 롤백됩니다.';

COMMIT;
