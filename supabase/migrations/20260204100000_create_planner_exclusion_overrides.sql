-- ============================================
-- planner_exclusion_overrides: 플래너별 제외일 오버라이드 테이블
-- 전역 제외일(시간관리)을 플래너별로 추가/제거할 수 있게 함
-- ============================================

BEGIN;

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS planner_exclusion_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_group_id uuid NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
  exclusion_date date NOT NULL,
  -- 'add': 전역에 없지만 이 플래너에만 추가
  -- 'remove': 전역에 있지만 이 플래너에서는 제외
  override_type text NOT NULL CHECK (override_type IN ('add', 'remove')),
  -- exclusion_type은 'add'일 때만 필수
  exclusion_type text CHECK (
    override_type = 'remove' OR exclusion_type IS NOT NULL
  ),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 플래너당 날짜별로 하나의 오버라이드만 허용
  UNIQUE(plan_group_id, exclusion_date)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_planner_exclusion_overrides_plan_group
  ON planner_exclusion_overrides(plan_group_id);

CREATE INDEX IF NOT EXISTS idx_planner_exclusion_overrides_date
  ON planner_exclusion_overrides(exclusion_date);

-- 3. updated_at 트리거
CREATE OR REPLACE FUNCTION update_planner_exclusion_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_planner_exclusion_overrides_updated_at ON planner_exclusion_overrides;
CREATE TRIGGER trigger_planner_exclusion_overrides_updated_at
  BEFORE UPDATE ON planner_exclusion_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_planner_exclusion_overrides_updated_at();

-- 4. RLS 활성화
ALTER TABLE planner_exclusion_overrides ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책: 학생 본인의 플랜 그룹 오버라이드
DROP POLICY IF EXISTS "Users can manage own plan group overrides" ON planner_exclusion_overrides;
CREATE POLICY "Users can manage own plan group overrides"
  ON planner_exclusion_overrides
  FOR ALL
  USING (
    plan_group_id IN (
      SELECT id FROM plan_groups WHERE student_id = auth.uid()
    )
  );

-- 6. RLS 정책: 관리자/컨설턴트가 소속 테넌트의 학생 오버라이드 관리
DROP POLICY IF EXISTS "Admins can manage tenant overrides" ON planner_exclusion_overrides;
CREATE POLICY "Admins can manage tenant overrides"
  ON planner_exclusion_overrides
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

-- 7. 코멘트 추가
COMMENT ON TABLE planner_exclusion_overrides IS '플래너별 제외일 오버라이드. 전역 제외일(시간관리)을 플래너별로 커스터마이징';
COMMENT ON COLUMN planner_exclusion_overrides.override_type IS 'add: 이 플래너에만 추가, remove: 이 플래너에서 제외';
COMMENT ON COLUMN planner_exclusion_overrides.exclusion_type IS '제외일 유형 (휴가, 개인사정, 휴일지정, 기타). add 타입일 때 필수';

COMMIT;
