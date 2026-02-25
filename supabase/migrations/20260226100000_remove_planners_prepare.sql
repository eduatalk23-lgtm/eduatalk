-- ============================================
-- Planner 엔티티 제거 준비 (Additive Migration)
-- ============================================
--
-- 기존 코드를 깨뜨리지 않는 additive 변경만 수행.
-- 1. calendars 테이블에 플래너 설정 컬럼 추가
-- 2. plan_groups에 calendar_id 컬럼 추가
-- 3. delete_calendar_cascade RPC 생성
--

-- =============================
-- 1) calendars 테이블에 플래너 설정 컬럼 추가
-- =============================
-- 플래너의 메타데이터(기간, 학습시간, 비학습시간 등)를 캘린더로 흡수

ALTER TABLE calendars ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS study_hours JSONB;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS self_study_hours JSONB;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS non_study_time_blocks JSONB;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS block_set_id UUID REFERENCES student_block_sets(id);
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS default_scheduler_type TEXT DEFAULT '1730_timetable';
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS default_scheduler_options JSONB;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS admin_memo TEXT;

COMMENT ON COLUMN calendars.status IS '캘린더 상태: active, draft, paused, archived, completed';
COMMENT ON COLUMN calendars.period_start IS '학습 기간 시작일';
COMMENT ON COLUMN calendars.period_end IS '학습 기간 종료일';
COMMENT ON COLUMN calendars.target_date IS '목표일 (시험일 등)';
COMMENT ON COLUMN calendars.study_hours IS '학습 시간대 {start, end}';
COMMENT ON COLUMN calendars.self_study_hours IS '자습 시간대 {start, end}';
COMMENT ON COLUMN calendars.non_study_time_blocks IS '비학습시간 블록 배열';
COMMENT ON COLUMN calendars.block_set_id IS '블록 세트 (FK: student_block_sets)';
COMMENT ON COLUMN calendars.default_scheduler_type IS '기본 스케줄러 타입';
COMMENT ON COLUMN calendars.default_scheduler_options IS '기본 스케줄러 옵션';
COMMENT ON COLUMN calendars.admin_memo IS '관리자 메모';

-- =============================
-- 2) plan_groups에 calendar_id 컬럼 추가
-- =============================
ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id);

CREATE INDEX IF NOT EXISTS idx_plan_groups_calendar_id
  ON plan_groups(calendar_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN plan_groups.calendar_id IS '소속 캘린더 (planner_id 대체)';

-- =============================
-- 3) delete_calendar_cascade RPC 생성
-- =============================
-- delete_planner_cascade와 동일 로직이지만 calendar_id 기준

-- 결과 타입 정의
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delete_calendar_result') THEN
    CREATE TYPE delete_calendar_result AS (
      success BOOLEAN,
      calendar_id UUID,
      deleted_plan_groups_count INTEGER,
      deleted_student_plans_count INTEGER,
      deleted_events_count INTEGER,
      error TEXT,
      error_code TEXT
    );
  END IF;
END $$;

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

  -- plan_group IDs 수집 (calendar_id 또는 planner_id 기준)
  SELECT ARRAY_AGG(id) INTO v_plan_group_ids
  FROM plan_groups
  WHERE (
    calendar_id = p_calendar_id
    OR planner_id IN (SELECT id FROM planners WHERE calendar_id = p_calendar_id)
  )
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
  WHERE (
    calendar_id = p_calendar_id
    OR planner_id IN (SELECT id FROM planners WHERE calendar_id = p_calendar_id)
  )
  AND deleted_at IS NULL;

  -- calendar_events soft-delete
  WITH updated AS (
    UPDATE calendar_events SET deleted_at = v_now, status = 'cancelled'
    WHERE calendar_id = p_calendar_id AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_events_count FROM updated;

  -- 연결된 planners soft-delete
  UPDATE planners SET deleted_at = v_now, calendar_id = NULL
  WHERE calendar_id = p_calendar_id AND deleted_at IS NULL;

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
