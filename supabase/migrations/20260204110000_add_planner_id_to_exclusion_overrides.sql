-- ============================================
-- planner_exclusion_overrides: 플래너 ID 지원 추가
-- 플래너(planners) 또는 플랜그룹(plan_groups) 모두에서 사용 가능하도록 확장
-- ============================================

BEGIN;

-- 1. plan_group_id를 nullable로 변경
ALTER TABLE planner_exclusion_overrides
  ALTER COLUMN plan_group_id DROP NOT NULL;

-- 2. planner_id 컬럼 추가
ALTER TABLE planner_exclusion_overrides
  ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE CASCADE;

-- 3. 기존 unique 제약 조건 삭제
ALTER TABLE planner_exclusion_overrides
  DROP CONSTRAINT IF EXISTS planner_exclusion_overrides_plan_group_id_exclusion_date_key;

-- 4. 새 unique 제약 조건 추가 (plan_group_id 또는 planner_id 기준)
-- plan_group_id가 있는 경우
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusion_overrides_plan_group_date
  ON planner_exclusion_overrides(plan_group_id, exclusion_date)
  WHERE plan_group_id IS NOT NULL;

-- planner_id가 있는 경우
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusion_overrides_planner_date
  ON planner_exclusion_overrides(planner_id, exclusion_date)
  WHERE planner_id IS NOT NULL;

-- 5. CHECK 제약 조건: plan_group_id 또는 planner_id 중 하나는 반드시 있어야 함
ALTER TABLE planner_exclusion_overrides
  DROP CONSTRAINT IF EXISTS chk_exclusion_overrides_has_parent;

ALTER TABLE planner_exclusion_overrides
  ADD CONSTRAINT chk_exclusion_overrides_has_parent
  CHECK (plan_group_id IS NOT NULL OR planner_id IS NOT NULL);

-- 6. planner_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_planner_exclusion_overrides_planner
  ON planner_exclusion_overrides(planner_id)
  WHERE planner_id IS NOT NULL;

-- 7. RLS 정책 업데이트: 플래너 접근 권한 추가
DROP POLICY IF EXISTS "Users can manage own plan group overrides" ON planner_exclusion_overrides;
DROP POLICY IF EXISTS "Admins can manage tenant overrides" ON planner_exclusion_overrides;

-- 학생 본인의 플랜그룹 또는 플래너 오버라이드
CREATE POLICY "Users can manage own overrides"
  ON planner_exclusion_overrides
  FOR ALL
  USING (
    -- plan_group_id를 통한 접근
    (plan_group_id IS NOT NULL AND plan_group_id IN (
      SELECT id FROM plan_groups WHERE student_id = auth.uid()
    ))
    OR
    -- planner_id를 통한 접근
    (planner_id IS NOT NULL AND planner_id IN (
      SELECT id FROM planners WHERE student_id = auth.uid()
    ))
  );

-- 관리자/컨설턴트 접근
CREATE POLICY "Admins can manage tenant overrides"
  ON planner_exclusion_overrides
  FOR ALL
  USING (
    -- plan_group_id를 통한 접근
    (plan_group_id IS NOT NULL AND plan_group_id IN (
      SELECT pg.id FROM plan_groups pg
      JOIN students s ON pg.student_id = s.id
      WHERE s.tenant_id IN (
        SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid()
      )
    ))
    OR
    -- planner_id를 통한 접근
    (planner_id IS NOT NULL AND planner_id IN (
      SELECT p.id FROM planners p
      JOIN students s ON p.student_id = s.id
      WHERE s.tenant_id IN (
        SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid()
      )
    ))
  );

-- 8. 코멘트 업데이트
COMMENT ON COLUMN planner_exclusion_overrides.planner_id IS '플래너 ID (planners 참조). plan_group_id와 상호 배타적';
COMMENT ON COLUMN planner_exclusion_overrides.plan_group_id IS '플랜그룹 ID (plan_groups 참조). planner_id와 상호 배타적';

COMMIT;
