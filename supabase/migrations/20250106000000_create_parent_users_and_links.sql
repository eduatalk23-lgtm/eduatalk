-- Migration: Create parent_users and parent_student_links tables
-- Description: 학부모 권한 모델 및 부모-학생 연결 테이블 생성
-- Date: 2025-01-06

-- ============================================
-- 1. 학부모 사용자 테이블 (parent_users)
-- ============================================

CREATE TABLE IF NOT EXISTS parent_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parent_users_created_at ON parent_users(created_at DESC);

-- RLS 설정
ALTER TABLE parent_users ENABLE ROW LEVEL SECURITY;

-- 학부모는 자신의 정보만 조회 가능
DROP POLICY IF EXISTS "Parents can view their own info" ON parent_users;
CREATE POLICY "Parents can view their own info"
  ON parent_users
  FOR SELECT
  USING (auth.uid() = id);

-- 학부모는 자신의 정보만 수정 가능
DROP POLICY IF EXISTS "Parents can update their own info" ON parent_users;
CREATE POLICY "Parents can update their own info"
  ON parent_users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 관리자/컨설턴트는 모든 학부모 정보 조회 가능
DROP POLICY IF EXISTS "Admins can view all parent users" ON parent_users;
CREATE POLICY "Admins can view all parent users"
  ON parent_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  );

-- ============================================
-- 2. 부모-학생 연결 테이블 (parent_student_links)
-- ============================================

CREATE TABLE IF NOT EXISTS parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK (relation IN ('mother', 'father', 'guardian')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(parent_id, student_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent_id ON parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student_id ON parent_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_created_at ON parent_student_links(created_at DESC);

-- RLS 설정
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- 학부모는 자신이 연결된 학생만 조회 가능
DROP POLICY IF EXISTS "Parents can view their linked students" ON parent_student_links;
CREATE POLICY "Parents can view their linked students"
  ON parent_student_links
  FOR SELECT
  USING (auth.uid() = parent_id);

-- 학생은 자신에게 연결된 학부모 정보 조회 가능
DROP POLICY IF EXISTS "Students can view their linked parents" ON parent_student_links;
CREATE POLICY "Students can view their linked parents"
  ON parent_student_links
  FOR SELECT
  USING (auth.uid() = student_id);

-- 관리자/컨설턴트는 모든 연결 정보 조회 및 관리 가능
DROP POLICY IF EXISTS "Admins can view all parent-student links" ON parent_student_links;
CREATE POLICY "Admins can view all parent-student links"
  ON parent_student_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  );

-- 관리자/컨설턴트는 연결 생성 가능
DROP POLICY IF EXISTS "Admins can insert parent-student links" ON parent_student_links;
CREATE POLICY "Admins can insert parent-student links"
  ON parent_student_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  );

-- 관리자/컨설턴트는 연결 수정 가능
DROP POLICY IF EXISTS "Admins can update parent-student links" ON parent_student_links;
CREATE POLICY "Admins can update parent-student links"
  ON parent_student_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  );

-- 관리자/컨설턴트는 연결 삭제 가능
DROP POLICY IF EXISTS "Admins can delete parent-student links" ON parent_student_links;
CREATE POLICY "Admins can delete parent-student links"
  ON parent_student_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  );

-- ============================================
-- 3. 코멘트 추가 (문서화)
-- ============================================

COMMENT ON TABLE parent_users IS '학부모 사용자 정보를 저장하는 테이블';
COMMENT ON COLUMN parent_users.id IS 'Supabase auth.users.id와 동일';
COMMENT ON COLUMN parent_users.name IS '학부모 이름';

COMMENT ON TABLE parent_student_links IS '학부모-학생 연결 정보를 저장하는 테이블';
COMMENT ON COLUMN parent_student_links.parent_id IS '학부모 ID';
COMMENT ON COLUMN parent_student_links.student_id IS '학생 ID';
COMMENT ON COLUMN parent_student_links.relation IS '관계: mother, father, guardian';

