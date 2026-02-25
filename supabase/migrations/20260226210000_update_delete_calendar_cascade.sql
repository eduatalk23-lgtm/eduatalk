-- ============================================
-- Update delete_calendar_cascade: remove planners fallback
-- ============================================
-- plan_groups는 이제 calendar_id로만 연결됨.
-- planners 테이블 참조를 제거하여 향후 planners DROP 시 충돌 방지.

CREATE OR REPLACE FUNCTION delete_calendar_cascade(
  p_calendar_id UUID, p_tenant_id UUID DEFAULT NULL
) RETURNS delete_calendar_result
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_result delete_calendar_result;
  v_now TIMESTAMPTZ := NOW();
  v_plan_group_ids UUID[];
  v_plans_count INTEGER := 0;
  v_events_count INTEGER := 0;
BEGIN
  v_result.success := FALSE;
  v_result.calendar_id := p_calendar_id;

  -- 캘린더 존재 확인
  IF NOT EXISTS(SELECT 1 FROM calendars WHERE id = p_calendar_id AND deleted_at IS NULL) THEN
    v_result.error := '캘린더를 찾을 수 없습니다.';
    v_result.error_code := 'NOT_FOUND';
    RETURN v_result;
  END IF;

  -- Primary 캘린더 삭제 방지
  IF EXISTS(SELECT 1 FROM calendars WHERE id = p_calendar_id AND is_student_primary = true) THEN
    v_result.error := '기본 캘린더는 삭제할 수 없습니다.';
    v_result.error_code := 'CANNOT_DELETE_PRIMARY';
    RETURN v_result;
  END IF;

  -- plan_group IDs 수집 (calendar_id 기준)
  SELECT ARRAY_AGG(id) INTO v_plan_group_ids
  FROM plan_groups
  WHERE calendar_id = p_calendar_id
  AND deleted_at IS NULL;

  -- student_plan soft-delete
  IF v_plan_group_ids IS NOT NULL THEN
    WITH updated AS (
      UPDATE student_plan SET deleted_at = v_now
      WHERE plan_group_id = ANY(v_plan_group_ids) AND deleted_at IS NULL
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_plans_count FROM updated;
  END IF;

  -- plan_groups soft-delete
  UPDATE plan_groups SET deleted_at = v_now
  WHERE calendar_id = p_calendar_id
  AND deleted_at IS NULL;

  -- calendar_events soft-delete
  WITH updated AS (
    UPDATE calendar_events SET deleted_at = v_now, status = 'cancelled'
    WHERE calendar_id = p_calendar_id AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_events_count FROM updated;

  -- calendar soft-delete
  UPDATE calendars SET deleted_at = v_now
  WHERE id = p_calendar_id;

  -- calendar_list 정리
  DELETE FROM calendar_list WHERE calendar_id = p_calendar_id;

  v_result.success := TRUE;
  v_result.deleted_plan_groups_count := COALESCE(array_length(v_plan_group_ids, 1), 0);
  v_result.deleted_student_plans_count := v_plans_count;
  v_result.deleted_events_count := v_events_count;
  RETURN v_result;
END;
$$;
