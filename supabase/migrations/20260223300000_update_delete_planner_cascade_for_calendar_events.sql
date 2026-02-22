-- ============================================
-- delete_planner_cascade() 업데이트
-- student_non_study_time 하드 삭제 제거, calendar_events 소프트 삭제로 전환
-- ============================================
--
-- 전제:
--   - 코드가 calendar_events 기반으로 전환 완료
--   - student_non_study_time은 더 이상 코드에서 사용하지 않음
--   - calendar_events는 소프트 삭제 (deleted_at + status='cancelled') 패턴 사용
--

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
  v_calendar_ids UUID[];
  v_schedule_ids UUID[];
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

  -- 5. calendar_events 소프트 삭제 (통합 비학습시간/제외일/학원 데이터)
  SELECT ARRAY_AGG(id) INTO v_calendar_ids
  FROM calendars
  WHERE planner_id = p_planner_id;

  IF v_calendar_ids IS NOT NULL AND array_length(v_calendar_ids, 1) > 0 THEN
    WITH updated AS (
      UPDATE calendar_events
      SET deleted_at = v_now, status = 'cancelled'
      WHERE calendar_id = ANY(v_calendar_ids)
        AND deleted_at IS NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_exclusions_count FROM updated;

    -- calendars 자체도 소프트 삭제
    UPDATE calendars
    SET deleted_at = v_now
    WHERE id = ANY(v_calendar_ids)
      AND deleted_at IS NULL;
  END IF;

  -- 6. planner_exclusion_overrides 하드 삭제
  DELETE FROM planner_exclusion_overrides
  WHERE planner_id = p_planner_id;

  -- 7. availability 테이블 삭제
  SELECT ARRAY_AGG(id) INTO v_schedule_ids
  FROM availability_schedules
  WHERE planner_id = p_planner_id;

  IF v_schedule_ids IS NOT NULL AND array_length(v_schedule_ids, 1) > 0 THEN
    DELETE FROM availability_windows
    WHERE schedule_id = ANY(v_schedule_ids);

    DELETE FROM availability_schedules
    WHERE id = ANY(v_schedule_ids);
  END IF;

  -- 8. planners 소프트 삭제
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

COMMENT ON FUNCTION delete_planner_cascade IS
'플래너와 하위 데이터를 원자적으로 Cascade 삭제합니다.
- student_plan: 소프트 삭제
- plan_groups: 소프트 삭제
- calendar_events: 소프트 삭제 (deleted_at + status=cancelled)
- calendars: 소프트 삭제
- planner_exclusion_overrides: 하드 삭제
- availability_schedules + availability_windows: 하드 삭제
- planners: 소프트 삭제
부분 실패 시 자동 롤백됩니다.';
