-- ============================================
-- Calendar-First Architecture Migration
-- ============================================
--
-- 기존 Planner → Calendar(1:1) 구조를
-- Student → Calendar(독립, N개) → Planner(optional) 구조로 전환.
--
-- 핵심 변경:
--   1. calendars.planner_id 제거 → planners.calendar_id 추가 (역전)
--   2. calendars.is_student_primary 추가 (학생당 1개 기본 캘린더)
--   3. calendar_list 테이블 신규 (뷰 레이어: 표시여부/색상/순서)
--   4. delete_planner_cascade 업데이트 (Planner 삭제 시 Calendar 보존)
--
-- ⚠️ 기존 데이터 전부 삭제 (Clean Slate)

-- =============================
-- 1) 기존 데이터 정리
-- =============================
-- FK cascade로 calendar_events, event_study_data 등 자동 삭제
TRUNCATE calendar_events CASCADE;
TRUNCATE calendars CASCADE;
TRUNCATE availability_windows CASCADE;
TRUNCATE availability_schedules CASCADE;

-- plan_groups, student_plan 도 정리 (planners 삭제 시 필요)
UPDATE student_plan SET deleted_at = NOW() WHERE deleted_at IS NULL;
UPDATE plan_groups SET deleted_at = NOW() WHERE deleted_at IS NULL;
UPDATE planners SET deleted_at = NOW() WHERE deleted_at IS NULL;

-- =============================
-- 2) calendars: planner_id 제거, is_student_primary 추가
-- =============================
ALTER TABLE calendars DROP CONSTRAINT IF EXISTS calendars_planner_id_fkey;
DROP INDEX IF EXISTS idx_calendars_planner;
ALTER TABLE calendars DROP COLUMN IF EXISTS planner_id;

ALTER TABLE calendars ADD COLUMN IF NOT EXISTS is_student_primary BOOLEAN DEFAULT false;

-- 학생당 primary 캘린더는 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendars_student_primary
  ON calendars(owner_id)
  WHERE is_student_primary = true AND deleted_at IS NULL;

COMMENT ON COLUMN calendars.is_student_primary IS '학생당 자동 생성된 기본 캘린더 (1개만)';

-- =============================
-- 3) planners: calendar_id FK 추가
-- =============================
ALTER TABLE planners
  ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_planners_calendar_id
  ON planners(calendar_id)
  WHERE calendar_id IS NOT NULL;

COMMENT ON COLUMN planners.calendar_id IS '이 플래너가 속한 캘린더 (Calendar-first 모델)';

-- =============================
-- 4) calendar_list 테이블 생성
-- =============================
-- GCal의 CalendarList 리소스 대응. 사용자별 표시 설정.
CREATE TABLE IF NOT EXISTS calendar_list (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL,
  calendar_id     UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  display_name    TEXT,
  color_override  TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  access_role     TEXT NOT NULL DEFAULT 'owner'
    CHECK (access_role IN ('owner', 'writer', 'reader')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_calendar_list_user_calendar UNIQUE (user_id, calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_list_user
  ON calendar_list(user_id) WHERE is_visible = true;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_calendar_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER tr_calendar_list_updated_at
  BEFORE UPDATE ON calendar_list
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_list_updated_at();

-- RLS
ALTER TABLE calendar_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_list_owner_all" ON calendar_list
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "calendar_list_admin_all" ON calendar_list
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = (
          SELECT c.tenant_id FROM calendars c WHERE c.id = calendar_list.calendar_id
        )
    )
  );

COMMENT ON TABLE calendar_list IS 'GCal CalendarList 리소스 - 사용자별 캘린더 표시 설정';
COMMENT ON COLUMN calendar_list.display_name IS '사용자가 지정한 캘린더 표시 이름 (NULL이면 calendars.summary 사용)';
COMMENT ON COLUMN calendar_list.color_override IS '사용자가 지정한 색상 (NULL이면 calendars.default_color 사용)';
COMMENT ON COLUMN calendar_list.access_role IS 'owner | writer | reader';

-- =============================
-- 5) delete_planner_cascade 업데이트
-- =============================
-- Planner 삭제 시 Calendar는 보존. plan_groups/이벤트만 삭제.
CREATE OR REPLACE FUNCTION delete_planner_cascade(
  p_planner_id UUID, p_tenant_id UUID DEFAULT NULL
) RETURNS delete_planner_result
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_result delete_planner_result;
  v_now TIMESTAMPTZ := NOW();
  v_plan_group_ids UUID[];
  v_schedule_ids UUID[];
BEGIN
  v_result.success := FALSE;
  v_result.planner_id := p_planner_id;

  -- 플래너 존재 확인
  IF NOT EXISTS(SELECT 1 FROM planners WHERE id = p_planner_id AND deleted_at IS NULL) THEN
    v_result.error := '플래너를 찾을 수 없습니다.';
    v_result.error_code := 'NOT_FOUND';
    RETURN v_result;
  END IF;

  -- plan_group IDs 수집
  SELECT ARRAY_AGG(id) INTO v_plan_group_ids
  FROM plan_groups WHERE planner_id = p_planner_id AND deleted_at IS NULL;

  -- student_plan soft-delete
  IF v_plan_group_ids IS NOT NULL THEN
    UPDATE student_plan SET deleted_at = v_now
    WHERE plan_group_id = ANY(v_plan_group_ids) AND deleted_at IS NULL;
  END IF;

  -- plan_groups soft-delete
  UPDATE plan_groups SET deleted_at = v_now
  WHERE planner_id = p_planner_id AND deleted_at IS NULL;

  -- 학습 이벤트만 soft-delete (planner 소속 이벤트)
  UPDATE calendar_events SET deleted_at = v_now, status = 'cancelled'
  WHERE plan_group_id = ANY(COALESCE(v_plan_group_ids, ARRAY[]::UUID[]))
    AND deleted_at IS NULL;

  -- availability_schedules/windows 정리
  SELECT ARRAY_AGG(id) INTO v_schedule_ids
  FROM availability_schedules WHERE planner_id = p_planner_id;
  IF v_schedule_ids IS NOT NULL THEN
    DELETE FROM availability_windows WHERE schedule_id = ANY(v_schedule_ids);
    DELETE FROM availability_schedules WHERE id = ANY(v_schedule_ids);
  END IF;

  -- planner soft-delete + calendar_id 해제 (Calendar 보존)
  UPDATE planners SET deleted_at = v_now, calendar_id = NULL
  WHERE id = p_planner_id;

  v_result.success := TRUE;
  v_result.deleted_plan_groups_count := COALESCE(array_length(v_plan_group_ids, 1), 0);
  RETURN v_result;
END;
$$;
