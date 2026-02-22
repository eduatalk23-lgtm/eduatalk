-- ============================================
-- student_non_study_time 테이블 확장
-- 제외일/학원 일정을 통합 캘린더 이벤트로 관리
-- ============================================
--
-- 목적: planner_exclusions + planner_academy_schedules 의 날짜 레코드를
--        student_non_study_time 테이블에 통합하여 단일 소스로 관리
-- 변경:
--   1. start_time, end_time nullable (종일 이벤트 = 제외일)
--   2. is_all_day, group_id, exclusion_type, source 컬럼 추가
--

BEGIN;

-- 1. start_time, end_time nullable로 변경 (제외일은 종일 이벤트)
ALTER TABLE student_non_study_time
  ALTER COLUMN start_time DROP NOT NULL,
  ALTER COLUMN end_time DROP NOT NULL;

-- 2. 신규 컬럼 추가
ALTER TABLE student_non_study_time
  ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_id UUID NULL,
  ADD COLUMN IF NOT EXISTS exclusion_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'template';

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_snst_group_id
  ON student_non_study_time(group_id) WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snst_type_date
  ON student_non_study_time(planner_id, type, plan_date) WHERE type = '제외일';

-- 4. 컬럼 코멘트
COMMENT ON COLUMN student_non_study_time.is_all_day IS '종일 이벤트 여부 (제외일 등)';
COMMENT ON COLUMN student_non_study_time.group_id IS '반복 일정 그룹 ID (일괄 관리용)';
COMMENT ON COLUMN student_non_study_time.exclusion_type IS '제외일 세부 유형: 휴가, 개인사정, 휴일지정, 기타';
COMMENT ON COLUMN student_non_study_time.source IS '레코드 생성 출처: template, manual, imported, migration';

-- 5. delete_planner_cascade 함수에 student_non_study_time 삭제 추가
-- (planners 소프트 삭제 시 ON DELETE CASCADE가 발동하지 않으므로 명시적 삭제)
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

  -- 3. student_plan 소프트 삭제
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

  -- 5. planner_exclusions 하드 삭제
  WITH deleted AS (
    DELETE FROM planner_exclusions
    WHERE planner_id = p_planner_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_exclusions_count FROM deleted;

  -- 6. planner_academy_schedules 하드 삭제
  WITH deleted AS (
    DELETE FROM planner_academy_schedules
    WHERE planner_id = p_planner_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_schedules_count FROM deleted;

  -- 7. student_non_study_time 하드 삭제 (신규 추가)
  DELETE FROM student_non_study_time
  WHERE planner_id = p_planner_id;

  -- 8. planner_exclusion_overrides 하드 삭제
  DELETE FROM planner_exclusion_overrides
  WHERE planner_id = p_planner_id;

  -- 9. planners 소프트 삭제
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

COMMIT;
