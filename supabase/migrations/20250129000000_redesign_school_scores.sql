-- Migration: Redesign school scores structure
-- Description: 내신 성적 구조 재설계 - class_rank/test_date 제거, 교과/과목 관리 테이블 추가
-- Date: 2025-01-29

-- ============================================
-- 1. 내신 성적 테이블에서 불필요한 컬럼 제거
-- ============================================

-- class_rank와 test_date 컬럼 제거
ALTER TABLE student_school_scores 
  DROP COLUMN IF EXISTS class_rank,
  DROP COLUMN IF EXISTS test_date;

-- ============================================
-- 2. 교과 그룹 관리 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS subject_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subject_groups_tenant_id ON subject_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subject_groups_display_order ON subject_groups(tenant_id, display_order);

-- ============================================
-- 3. 과목 관리 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_group_id uuid NOT NULL REFERENCES subject_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, subject_group_id, name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subjects_tenant_id ON subjects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subjects_subject_group_id ON subjects(subject_group_id);
CREATE INDEX IF NOT EXISTS idx_subjects_display_order ON subjects(subject_group_id, display_order);

-- ============================================
-- 4. RLS 정책 설정
-- ============================================

-- subject_groups 테이블 RLS
ALTER TABLE subject_groups ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 tenant에 속한 교과 조회/수정 가능
DROP POLICY IF EXISTS "Admins can view subject groups" ON subject_groups;
CREATE POLICY "Admins can view subject groups"
  ON subject_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subject_groups.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Admins can insert subject groups" ON subject_groups;
CREATE POLICY "Admins can insert subject groups"
  ON subject_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subject_groups.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Admins can update subject groups" ON subject_groups;
CREATE POLICY "Admins can update subject groups"
  ON subject_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subject_groups.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subject_groups.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Admins can delete subject groups" ON subject_groups;
CREATE POLICY "Admins can delete subject groups"
  ON subject_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subject_groups.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생은 자신의 tenant에 속한 교과 조회만 가능
DROP POLICY IF EXISTS "Students can view subject groups" ON subject_groups;
CREATE POLICY "Students can view subject groups"
  ON subject_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
        AND students.tenant_id = subject_groups.tenant_id
    )
  );

-- subjects 테이블 RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 tenant에 속한 과목 조회/수정 가능
DROP POLICY IF EXISTS "Admins can view subjects" ON subjects;
CREATE POLICY "Admins can view subjects"
  ON subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subjects.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Admins can insert subjects" ON subjects;
CREATE POLICY "Admins can insert subjects"
  ON subjects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subjects.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Admins can update subjects" ON subjects;
CREATE POLICY "Admins can update subjects"
  ON subjects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subjects.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subjects.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Admins can delete subjects" ON subjects;
CREATE POLICY "Admins can delete subjects"
  ON subjects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = subjects.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생은 자신의 tenant에 속한 과목 조회만 가능
DROP POLICY IF EXISTS "Students can view subjects" ON subjects;
CREATE POLICY "Students can view subjects"
  ON subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
        AND students.tenant_id = subjects.tenant_id
    )
  );

-- ============================================
-- 5. updated_at 트리거 함수 생성
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DROP TRIGGER IF EXISTS update_subject_groups_updated_at ON subject_groups;
CREATE TRIGGER update_subject_groups_updated_at
  BEFORE UPDATE ON subject_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 코멘트 추가
-- ============================================

COMMENT ON TABLE subject_groups IS '교과 그룹 관리 테이블 (국어, 수학, 영어, 한국사, 과학 등)';
COMMENT ON COLUMN subject_groups.tenant_id IS '교과 그룹이 속한 기관(tenant) ID';
COMMENT ON COLUMN subject_groups.name IS '교과 그룹명 (예: 국어, 수학)';
COMMENT ON COLUMN subject_groups.display_order IS '표시 순서';

COMMENT ON TABLE subjects IS '과목 관리 테이블 (교과 그룹에 속한 세부 과목)';
COMMENT ON COLUMN subjects.tenant_id IS '과목이 속한 기관(tenant) ID';
COMMENT ON COLUMN subjects.subject_group_id IS '소속 교과 그룹 ID';
COMMENT ON COLUMN subjects.name IS '과목명 (예: 수학Ⅰ, 수학Ⅱ)';
COMMENT ON COLUMN subjects.display_order IS '표시 순서';

