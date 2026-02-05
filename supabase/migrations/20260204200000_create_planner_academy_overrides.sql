-- ============================================
-- planner_academy_overrides: 플래너별 학원 일정 오버라이드 테이블
-- 전역 학원 일정(시간관리)을 플래너별로 추가/제거/수정할 수 있게 함
--
-- 제외일 오버라이드(planner_exclusion_overrides)와 동일한 패턴 적용
-- ============================================

BEGIN;

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS planner_academy_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 상위 엔티티 (둘 중 하나만 NOT NULL)
  planner_id uuid REFERENCES planners(id) ON DELETE CASCADE,
  plan_group_id uuid REFERENCES plan_groups(id) ON DELETE CASCADE,

  -- 오버라이드 대상 (전역 academy_schedule의 id 또는 NULL)
  -- NULL이면 신규 추가, 값이 있으면 기존 일정 수정/제거
  source_schedule_id uuid REFERENCES academy_schedules(id) ON DELETE CASCADE,

  -- 오버라이드 타입
  -- 'add': 전역에 없지만 이 플래너에만 추가
  -- 'remove': 전역에 있지만 이 플래너에서는 제외
  -- 'modify': 전역 일정의 시간/메타데이터 변경
  override_type text NOT NULL CHECK (override_type IN ('add', 'remove', 'modify')),

  -- 학원 일정 필드 (add/modify 시 사용)
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time,
  end_time time,
  academy_name text,
  subject text,
  travel_time integer DEFAULT 60,

  -- 메타데이터
  reason text, -- 오버라이드 사유
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 제약 조건: planner_id 또는 plan_group_id 중 하나만 설정
  CONSTRAINT chk_parent_entity CHECK (
    (planner_id IS NOT NULL AND plan_group_id IS NULL) OR
    (planner_id IS NULL AND plan_group_id IS NOT NULL)
  ),

  -- 제약 조건: add 타입은 day_of_week, start_time, end_time 필수
  CONSTRAINT chk_add_required_fields CHECK (
    override_type != 'add' OR (
      day_of_week IS NOT NULL AND
      start_time IS NOT NULL AND
      end_time IS NOT NULL
    )
  ),

  -- 제약 조건: remove 타입은 source_schedule_id 필수
  CONSTRAINT chk_remove_source_required CHECK (
    override_type != 'remove' OR source_schedule_id IS NOT NULL
  ),

  -- 제약 조건: modify 타입은 source_schedule_id 필수
  CONSTRAINT chk_modify_source_required CHECK (
    override_type != 'modify' OR source_schedule_id IS NOT NULL
  )
);

-- 2. 부분 유니크 인덱스 (플래너별로 source_schedule_id당 하나의 오버라이드)
CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_academy_overrides_planner_source
  ON planner_academy_overrides(planner_id, source_schedule_id)
  WHERE planner_id IS NOT NULL AND source_schedule_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_academy_overrides_plan_group_source
  ON planner_academy_overrides(plan_group_id, source_schedule_id)
  WHERE plan_group_id IS NOT NULL AND source_schedule_id IS NOT NULL;

-- 플래너별 add 타입 유니크 (같은 요일/시간에 중복 추가 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_academy_overrides_planner_add
  ON planner_academy_overrides(planner_id, day_of_week, start_time, end_time)
  WHERE planner_id IS NOT NULL AND override_type = 'add';

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_academy_overrides_plan_group_add
  ON planner_academy_overrides(plan_group_id, day_of_week, start_time, end_time)
  WHERE plan_group_id IS NOT NULL AND override_type = 'add';

-- 3. 일반 인덱스
CREATE INDEX IF NOT EXISTS idx_planner_academy_overrides_planner
  ON planner_academy_overrides(planner_id)
  WHERE planner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planner_academy_overrides_plan_group
  ON planner_academy_overrides(plan_group_id)
  WHERE plan_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planner_academy_overrides_source
  ON planner_academy_overrides(source_schedule_id)
  WHERE source_schedule_id IS NOT NULL;

-- 4. updated_at 트리거
CREATE OR REPLACE FUNCTION update_planner_academy_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_planner_academy_overrides_updated_at ON planner_academy_overrides;
CREATE TRIGGER trigger_planner_academy_overrides_updated_at
  BEFORE UPDATE ON planner_academy_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_planner_academy_overrides_updated_at();

-- 5. RLS 활성화
ALTER TABLE planner_academy_overrides ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책: 학생 본인의 플래너/플랜그룹 오버라이드
DROP POLICY IF EXISTS "Users can manage own academy overrides via planner" ON planner_academy_overrides;
CREATE POLICY "Users can manage own academy overrides via planner"
  ON planner_academy_overrides
  FOR ALL
  USING (
    planner_id IN (
      SELECT id FROM planners WHERE student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own academy overrides via plan_group" ON planner_academy_overrides;
CREATE POLICY "Users can manage own academy overrides via plan_group"
  ON planner_academy_overrides
  FOR ALL
  USING (
    plan_group_id IN (
      SELECT id FROM plan_groups WHERE student_id = auth.uid()
    )
  );

-- 7. RLS 정책: 관리자/컨설턴트가 소속 테넌트의 학생 오버라이드 관리
DROP POLICY IF EXISTS "Admins can manage tenant academy overrides via planner" ON planner_academy_overrides;
CREATE POLICY "Admins can manage tenant academy overrides via planner"
  ON planner_academy_overrides
  FOR ALL
  USING (
    planner_id IN (
      SELECT p.id FROM planners p
      JOIN students s ON p.student_id = s.id
      WHERE s.tenant_id IN (
        SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage tenant academy overrides via plan_group" ON planner_academy_overrides;
CREATE POLICY "Admins can manage tenant academy overrides via plan_group"
  ON planner_academy_overrides
  FOR ALL
  USING (
    plan_group_id IN (
      SELECT pg.id FROM plan_groups pg
      JOIN students s ON pg.student_id = s.id
      WHERE s.tenant_id IN (
        SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid()
      )
    )
  );

-- 8. 코멘트 추가
COMMENT ON TABLE planner_academy_overrides IS '플래너별 학원 일정 오버라이드. 전역 학원 일정(시간관리)을 플래너별로 커스터마이징';
COMMENT ON COLUMN planner_academy_overrides.override_type IS 'add: 플래너에만 추가, remove: 플래너에서 제외, modify: 시간/메타데이터 변경';
COMMENT ON COLUMN planner_academy_overrides.source_schedule_id IS '원본 전역 학원 일정 ID. add 타입은 NULL, remove/modify 타입은 필수';
COMMENT ON COLUMN planner_academy_overrides.day_of_week IS '요일 (0: 일요일 ~ 6: 토요일). add/modify 시 사용';
COMMENT ON COLUMN planner_academy_overrides.travel_time IS '이동 시간 (분). 기본값 60분';

COMMIT;
