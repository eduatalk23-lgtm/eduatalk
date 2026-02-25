-- ============================================
-- Planner 엔티티 완전 제거
-- ============================================
-- Phase 5-A: planners 테이블 DROP + 관련 정리
-- 선행 조건: 20260226100000_remove_planners_prepare.sql 적용 완료
--

-- =============================
-- 1) plan_groups.calendar_id 백필
-- =============================
UPDATE plan_groups pg
SET calendar_id = p.calendar_id
FROM planners p
WHERE pg.planner_id = p.id
  AND pg.calendar_id IS NULL
  AND p.calendar_id IS NOT NULL;

-- =============================
-- 2) calendars 설정 백필
-- =============================
UPDATE calendars c
SET
  study_hours = COALESCE(c.study_hours, p.study_hours),
  self_study_hours = COALESCE(c.self_study_hours, p.self_study_hours),
  non_study_time_blocks = COALESCE(c.non_study_time_blocks, p.non_study_time_blocks),
  block_set_id = COALESCE(c.block_set_id, p.block_set_id),
  default_scheduler_type = COALESCE(c.default_scheduler_type, p.default_scheduler_type),
  default_scheduler_options = COALESCE(c.default_scheduler_options, p.default_scheduler_options),
  period_start = COALESCE(c.period_start, p.period_start),
  period_end = COALESCE(c.period_end, p.period_end),
  target_date = COALESCE(c.target_date, p.target_date),
  admin_memo = COALESCE(c.admin_memo, p.admin_memo)
FROM planners p
WHERE p.calendar_id = c.id
  AND p.deleted_at IS NULL;

-- =============================
-- 3) plan_groups.planner_id 컬럼 DROP
-- =============================
ALTER TABLE plan_groups DROP COLUMN IF EXISTS planner_id;

-- =============================
-- 4) delete_planner_cascade RPC DROP
-- =============================
DROP FUNCTION IF EXISTS delete_planner_cascade(UUID, UUID);

-- =============================
-- 5) planners 테이블 DROP
-- =============================
DROP TABLE IF EXISTS planners CASCADE;

-- =============================
-- 6) delete_calendar_cascade 업데이트
-- =============================
-- planners 참조 제거 (테이블이 이제 없으므로)
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

  IF NOT EXISTS(SELECT 1 FROM calendars WHERE id = p_calendar_id AND deleted_at IS NULL) THEN
    v_result.error := '캘린더를 찾을 수 없습니다.';
    v_result.error_code := 'NOT_FOUND';
    RETURN v_result;
  END IF;

  IF EXISTS(SELECT 1 FROM calendars WHERE id = p_calendar_id AND is_student_primary = true) THEN
    v_result.error := '기본 캘린더는 삭제할 수 없습니다.';
    v_result.error_code := 'CANNOT_DELETE_PRIMARY';
    RETURN v_result;
  END IF;

  SELECT ARRAY_AGG(id) INTO v_plan_group_ids
  FROM plan_groups
  WHERE calendar_id = p_calendar_id AND deleted_at IS NULL;

  IF v_plan_group_ids IS NOT NULL THEN
    WITH updated AS (
      UPDATE student_plan SET deleted_at = v_now
      WHERE plan_group_id = ANY(v_plan_group_ids) AND deleted_at IS NULL
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_plans_count FROM updated;
  END IF;

  UPDATE plan_groups SET deleted_at = v_now
  WHERE calendar_id = p_calendar_id AND deleted_at IS NULL;

  WITH updated AS (
    UPDATE calendar_events SET deleted_at = v_now, status = 'cancelled'
    WHERE calendar_id = p_calendar_id AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_events_count FROM updated;

  UPDATE calendars SET deleted_at = v_now
  WHERE id = p_calendar_id;

  DELETE FROM calendar_list WHERE calendar_id = p_calendar_id;

  v_result.success := TRUE;
  v_result.deleted_plan_groups_count := COALESCE(array_length(v_plan_group_ids, 1), 0);
  v_result.deleted_student_plans_count := v_plans_count;
  v_result.deleted_events_count := v_events_count;
  RETURN v_result;
END;
$$;
