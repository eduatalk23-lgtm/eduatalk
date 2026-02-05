-- ============================================================================
-- 가족/형제자매 관계 시스템 (Phase 2)
--
-- 형제자매와 학부모를 명시적 family_groups 테이블로 그룹화하여 관리
-- ============================================================================

-- 1. family_groups 테이블 생성
CREATE TABLE IF NOT EXISTS family_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  family_name varchar(100),
  primary_contact_parent_id uuid REFERENCES parent_users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. family_parent_memberships 테이블 생성 (M:N 관계)
CREATE TABLE IF NOT EXISTS family_parent_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, parent_id),
  CONSTRAINT valid_membership_role CHECK (role IN ('primary', 'member', 'guardian'))
);

-- 3. students 테이블에 family_id 컬럼 추가
ALTER TABLE students
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES family_groups(id) ON DELETE SET NULL;

-- 4. parent_users 테이블에 primary_family_id 컬럼 추가
ALTER TABLE parent_users
ADD COLUMN IF NOT EXISTS primary_family_id uuid REFERENCES family_groups(id) ON DELETE SET NULL;

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

-- family_groups 인덱스
CREATE INDEX IF NOT EXISTS idx_family_groups_tenant_id
  ON family_groups(tenant_id);

CREATE INDEX IF NOT EXISTS idx_family_groups_primary_contact
  ON family_groups(primary_contact_parent_id)
  WHERE primary_contact_parent_id IS NOT NULL;

-- family_parent_memberships 인덱스
CREATE INDEX IF NOT EXISTS idx_family_parent_memberships_family_id
  ON family_parent_memberships(family_id);

CREATE INDEX IF NOT EXISTS idx_family_parent_memberships_parent_id
  ON family_parent_memberships(parent_id);

-- students.family_id 인덱스
CREATE INDEX IF NOT EXISTS idx_students_family_id
  ON students(family_id)
  WHERE family_id IS NOT NULL;

-- parent_users.primary_family_id 인덱스
CREATE INDEX IF NOT EXISTS idx_parent_users_primary_family_id
  ON parent_users(primary_family_id)
  WHERE primary_family_id IS NOT NULL;

-- ============================================================================
-- updated_at 자동 갱신 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_family_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_family_groups_updated_at ON family_groups;
CREATE TRIGGER trigger_family_groups_updated_at
  BEFORE UPDATE ON family_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_family_groups_updated_at();

-- ============================================================================
-- RLS 활성화 및 정책
-- ============================================================================

ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_parent_memberships ENABLE ROW LEVEL SECURITY;

-- family_groups RLS 정책

-- 관리자/컨설턴트: 자기 테넌트의 가족 조회
CREATE POLICY "Admins can view own tenant families"
  ON family_groups FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트에 가족 생성
CREATE POLICY "Admins can create families in own tenant"
  ON family_groups FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 가족 수정
CREATE POLICY "Admins can update own tenant families"
  ON family_groups FOR UPDATE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 가족 삭제
CREATE POLICY "Admins can delete own tenant families"
  ON family_groups FOR DELETE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 학부모: 자신이 속한 가족만 조회
CREATE POLICY "Parents can view their families"
  ON family_groups FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM family_parent_memberships
      WHERE parent_id = auth.uid()
    )
    OR primary_contact_parent_id = auth.uid()
  );

-- 학생: 자신이 속한 가족만 조회
CREATE POLICY "Students can view their family"
  ON family_groups FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM students
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );

-- family_parent_memberships RLS 정책

-- 관리자/컨설턴트: 자기 테넌트의 멤버십 조회
CREATE POLICY "Admins can view own tenant memberships"
  ON family_parent_memberships FOR SELECT
  USING (
    family_id IN (
      SELECT fg.id FROM family_groups fg
      JOIN admin_users au ON fg.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 멤버십 생성
CREATE POLICY "Admins can create memberships in own tenant"
  ON family_parent_memberships FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT fg.id FROM family_groups fg
      JOIN admin_users au ON fg.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 멤버십 수정
CREATE POLICY "Admins can update memberships in own tenant"
  ON family_parent_memberships FOR UPDATE
  USING (
    family_id IN (
      SELECT fg.id FROM family_groups fg
      JOIN admin_users au ON fg.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 멤버십 삭제
CREATE POLICY "Admins can delete memberships in own tenant"
  ON family_parent_memberships FOR DELETE
  USING (
    family_id IN (
      SELECT fg.id FROM family_groups fg
      JOIN admin_users au ON fg.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
    )
  );

-- 학부모: 자신의 멤버십만 조회
CREATE POLICY "Parents can view their memberships"
  ON family_parent_memberships FOR SELECT
  USING (parent_id = auth.uid());

-- ============================================================================
-- 테이블 코멘트
-- ============================================================================

COMMENT ON TABLE family_groups IS '가족 그룹 테이블 - 형제자매와 학부모를 그룹화';
COMMENT ON COLUMN family_groups.family_name IS '가족 이름 (예: 김씨 가족)';
COMMENT ON COLUMN family_groups.primary_contact_parent_id IS '주 연락처 학부모';
COMMENT ON COLUMN family_groups.notes IS '메모';
COMMENT ON COLUMN family_groups.created_by IS '가족 그룹을 생성한 관리자';

COMMENT ON TABLE family_parent_memberships IS '가족-학부모 M:N 관계 테이블';
COMMENT ON COLUMN family_parent_memberships.role IS 'primary: 주 보호자, member: 일반 구성원, guardian: 후견인';

COMMENT ON COLUMN students.family_id IS '학생이 속한 가족 그룹';
COMMENT ON COLUMN parent_users.primary_family_id IS '학부모의 기본 가족 그룹';
