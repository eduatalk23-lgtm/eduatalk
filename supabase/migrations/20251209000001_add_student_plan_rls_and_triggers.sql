-- ============================================
-- Migration: student_plan RLS 정책 및 updated_at 트리거
-- Date: 2025-12-09
-- Refs: docs/refactoring/03_phase_todo_list.md [P1-1], [P1-2]
-- ============================================

-- ============================================
-- Part 1: updated_at 자동 업데이트 트리거
-- ============================================

-- 1-1. 공통 트리거 함수 (없는 경우에만 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1-2. student_plan 테이블에 트리거 적용
DROP TRIGGER IF EXISTS update_student_plan_updated_at ON student_plan;
CREATE TRIGGER update_student_plan_updated_at
  BEFORE UPDATE ON student_plan
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_student_plan_updated_at ON student_plan IS 
'Automatically updates updated_at timestamp on row update';

-- 1-3. plan_groups 테이블에 트리거 적용
DROP TRIGGER IF EXISTS update_plan_groups_updated_at ON plan_groups;
CREATE TRIGGER update_plan_groups_updated_at
  BEFORE UPDATE ON plan_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_plan_groups_updated_at ON plan_groups IS 
'Automatically updates updated_at timestamp on row update';

-- 1-4. plan_group_contents 테이블에 트리거 적용 (테이블이 존재하는 경우에만)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_group_contents') THEN
    DROP TRIGGER IF EXISTS update_plan_group_contents_updated_at ON plan_group_contents;
    CREATE TRIGGER update_plan_group_contents_updated_at
      BEFORE UPDATE ON plan_group_contents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    
    COMMENT ON TRIGGER update_plan_group_contents_updated_at ON plan_group_contents IS 
    'Automatically updates updated_at timestamp on row update';
  END IF;
END $$;

-- ============================================
-- Part 2: student_plan RLS 정책
-- ============================================

-- 2-1. RLS 활성화
ALTER TABLE student_plan ENABLE ROW LEVEL SECURITY;

-- 2-2. 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "student_plan_student_select" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_insert" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_update" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_delete" ON student_plan;
DROP POLICY IF EXISTS "student_plan_admin_all" ON student_plan;
DROP POLICY IF EXISTS "student_plan_service_role" ON student_plan;

-- 2-3. 학생 정책: 자신의 레코드만 접근 가능
-- SELECT
CREATE POLICY "student_plan_student_select" ON student_plan
  FOR SELECT
  USING (
    student_id = auth.uid()
  );

-- INSERT
CREATE POLICY "student_plan_student_insert" ON student_plan
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
  );

-- UPDATE
CREATE POLICY "student_plan_student_update" ON student_plan
  FOR UPDATE
  USING (
    student_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid()
  );

-- DELETE
CREATE POLICY "student_plan_student_delete" ON student_plan
  FOR DELETE
  USING (
    student_id = auth.uid()
  );

-- 2-4. 관리자/컨설턴트 정책: 같은 테넌트 내 모든 레코드 접근 가능
CREATE POLICY "student_plan_admin_all" ON student_plan
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_plan.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_plan.tenant_id
    )
  );

-- 2-5. Service Role은 모든 접근 허용 (Server Actions용)
-- 참고: Supabase service role은 기본적으로 RLS를 bypass하므로 별도 정책 불필요
-- 하지만 명시적으로 추가할 경우:
-- CREATE POLICY "student_plan_service_role" ON student_plan
--   FOR ALL
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- Part 3: plan_groups RLS 정책
-- ============================================

-- 3-1. RLS 활성화
ALTER TABLE plan_groups ENABLE ROW LEVEL SECURITY;

-- 3-2. 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "plan_groups_student_select" ON plan_groups;
DROP POLICY IF EXISTS "plan_groups_student_all" ON plan_groups;
DROP POLICY IF EXISTS "plan_groups_admin_all" ON plan_groups;

-- 3-3. 학생 정책: 자신의 플랜 그룹만 접근 가능
CREATE POLICY "plan_groups_student_all" ON plan_groups
  FOR ALL
  USING (
    student_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid()
  );

-- 3-4. 관리자/컨설턴트 정책: 같은 테넌트 내 모든 플랜 그룹 접근 가능
CREATE POLICY "plan_groups_admin_all" ON plan_groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = plan_groups.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = plan_groups.tenant_id
    )
  );

-- ============================================
-- Part 4: plan_group_contents RLS 정책 (테이블이 존재하는 경우에만)
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_group_contents') THEN
    -- 4-1. RLS 활성화
    ALTER TABLE plan_group_contents ENABLE ROW LEVEL SECURITY;

    -- 4-2. 기존 정책 삭제 (있는 경우)
    DROP POLICY IF EXISTS "plan_group_contents_student_all" ON plan_group_contents;
    DROP POLICY IF EXISTS "plan_group_contents_admin_all" ON plan_group_contents;

    -- 4-3. 학생 정책: 자신의 플랜 그룹에 속한 콘텐츠만 접근 가능
    CREATE POLICY "plan_group_contents_student_all" ON plan_group_contents
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM plan_groups
          WHERE plan_groups.id = plan_group_contents.plan_group_id
          AND plan_groups.student_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM plan_groups
          WHERE plan_groups.id = plan_group_contents.plan_group_id
          AND plan_groups.student_id = auth.uid()
        )
      );

    -- 4-4. 관리자/컨설턴트 정책: 같은 테넌트 내 모든 콘텐츠 접근 가능
    CREATE POLICY "plan_group_contents_admin_all" ON plan_group_contents
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
          AND admin_users.tenant_id = plan_group_contents.tenant_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
          AND admin_users.tenant_id = plan_group_contents.tenant_id
        )
      );
  END IF;
END $$;

-- ============================================
-- Part 5: 인덱스 및 주석
-- ============================================

-- RLS 정책 조회 최적화를 위한 인덱스 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant
  ON admin_users(id, tenant_id);

-- 주석 추가
COMMENT ON POLICY "student_plan_student_select" ON student_plan IS 
'Students can only view their own plans';

COMMENT ON POLICY "student_plan_admin_all" ON student_plan IS 
'Admins can access all plans within their tenant';

COMMENT ON POLICY "plan_groups_student_all" ON plan_groups IS 
'Students can manage their own plan groups';

COMMENT ON POLICY "plan_groups_admin_all" ON plan_groups IS 
'Admins can manage all plan groups within their tenant';

