-- ============================================
-- Phase A: 레거시 테이블 정리
-- planner_exclusions, planner_academy_schedules DROP
-- ============================================
--
-- 전제:
--   - 데이터는 이미 student_non_study_time으로 이중 마이그레이션 완료
--   - 코드 참조는 이번 커밋에서 student_non_study_time으로 전환 완료
--   - planner_exclusion_overrides는 활발 사용 중이므로 범위 제외
--

BEGIN;

-- ============================================
-- 1. student_non_study_time FK 제거
--    (academy_schedule_id → planner_academy_schedules)
-- ============================================
ALTER TABLE student_non_study_time
  DROP CONSTRAINT IF EXISTS student_non_study_time_academy_schedule_id_fkey;

ALTER TABLE student_non_study_time
  DROP COLUMN IF EXISTS academy_schedule_id;


-- ============================================
-- 2. delete_planner_cascade() 업데이트
--    - Step 5,6 (planner_exclusions, planner_academy_schedules) 제거
--    - 캘린더 테이블 삭제 로직 추가
-- ============================================
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

  -- 5. student_non_study_time 하드 삭제 (통합 비학습시간/제외일/학원 데이터)
  DELETE FROM student_non_study_time
  WHERE planner_id = p_planner_id;

  -- 6. planner_exclusion_overrides 하드 삭제
  DELETE FROM planner_exclusion_overrides
  WHERE planner_id = p_planner_id;

  -- 7. 캘린더 테이블 삭제 (calendar_events → event_study_data는 CASCADE)
  SELECT ARRAY_AGG(id) INTO v_calendar_ids
  FROM calendars
  WHERE planner_id = p_planner_id;

  IF v_calendar_ids IS NOT NULL AND array_length(v_calendar_ids, 1) > 0 THEN
    -- event_study_data는 calendar_events ON DELETE CASCADE로 자동 삭제
    DELETE FROM calendar_events
    WHERE calendar_id = ANY(v_calendar_ids);

    DELETE FROM calendars
    WHERE id = ANY(v_calendar_ids);
  END IF;

  -- 8. availability 테이블 삭제 (availability_windows는 CASCADE)
  SELECT ARRAY_AGG(id) INTO v_schedule_ids
  FROM availability_schedules
  WHERE planner_id = p_planner_id;

  IF v_schedule_ids IS NOT NULL AND array_length(v_schedule_ids, 1) > 0 THEN
    DELETE FROM availability_windows
    WHERE schedule_id = ANY(v_schedule_ids);

    DELETE FROM availability_schedules
    WHERE id = ANY(v_schedule_ids);
  END IF;

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

-- 함수 코멘트 업데이트
COMMENT ON FUNCTION delete_planner_cascade IS
'플래너와 하위 데이터를 원자적으로 Cascade 삭제합니다.
- student_plan: 소프트 삭제
- plan_groups: 소프트 삭제
- student_non_study_time: 하드 삭제
- planner_exclusion_overrides: 하드 삭제
- calendar_events + event_study_data: 하드 삭제
- availability_schedules + availability_windows: 하드 삭제
- calendars: 하드 삭제
- planners: 소프트 삭제
부분 실패 시 자동 롤백됩니다.';


-- ============================================
-- 3. 레거시 테이블 DROP
-- ============================================
DROP TABLE IF EXISTS planner_academy_schedules CASCADE;
DROP TABLE IF EXISTS planner_exclusions CASCADE;


COMMIT;
