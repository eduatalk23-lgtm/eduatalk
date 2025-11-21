-- Migration: Create admin_users and student_consulting_notes tables
-- Description: 관리자 권한 모델 및 상담노트 테이블 생성
-- Date: 2025-01-05

-- ============================================
-- 1. 관리자 사용자 테이블 (admin_users)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'consultant', 'admin')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_created_at ON admin_users(created_at DESC);

-- RLS 설정
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 정보만 조회 가능
DROP POLICY IF EXISTS "Users can view their own admin info" ON admin_users;
CREATE POLICY "Users can view their own admin info"
  ON admin_users
  FOR SELECT
  USING (auth.uid() = id);

-- 관리자는 자신의 정보만 수정 가능
DROP POLICY IF EXISTS "Users can update their own admin info" ON admin_users;
CREATE POLICY "Users can update their own admin info"
  ON admin_users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. 상담노트 테이블 (student_consulting_notes)
-- ============================================

CREATE TABLE IF NOT EXISTS student_consulting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_consulting_notes_student_id ON student_consulting_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_consulting_notes_consultant_id ON student_consulting_notes(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consulting_notes_created_at ON student_consulting_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consulting_notes_student_created ON student_consulting_notes(student_id, created_at DESC);

-- RLS 설정
ALTER TABLE student_consulting_notes ENABLE ROW LEVEL SECURITY;

-- 학생은 자신의 상담노트 조회 가능
DROP POLICY IF EXISTS "Students can view their own consulting notes" ON student_consulting_notes;
CREATE POLICY "Students can view their own consulting notes"
  ON student_consulting_notes
  FOR SELECT
  USING (auth.uid() = student_id);

-- 컨설턴트/관리자는 모든 상담노트 조회 가능
DROP POLICY IF EXISTS "Consultants can view all consulting notes" ON student_consulting_notes;
CREATE POLICY "Consultants can view all consulting notes"
  ON student_consulting_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
  );

-- 컨설턴트/관리자는 상담노트 작성 가능
DROP POLICY IF EXISTS "Consultants can insert consulting notes" ON student_consulting_notes;
CREATE POLICY "Consultants can insert consulting notes"
  ON student_consulting_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
    AND consultant_id = auth.uid()
  );

-- 컨설턴트/관리자는 자신이 작성한 상담노트 수정 가능
DROP POLICY IF EXISTS "Consultants can update their own consulting notes" ON student_consulting_notes;
CREATE POLICY "Consultants can update their own consulting notes"
  ON student_consulting_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
    AND consultant_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
    AND consultant_id = auth.uid()
  );

-- 컨설턴트/관리자는 자신이 작성한 상담노트 삭제 가능
DROP POLICY IF EXISTS "Consultants can delete their own consulting notes" ON student_consulting_notes;
CREATE POLICY "Consultants can delete their own consulting notes"
  ON student_consulting_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('consultant', 'admin')
    )
    AND consultant_id = auth.uid()
  );

-- ============================================
-- 3. 코멘트 추가 (문서화)
-- ============================================

COMMENT ON TABLE admin_users IS '관리자 권한 정보를 저장하는 테이블';
COMMENT ON COLUMN admin_users.id IS 'Supabase auth.users.id와 동일';
COMMENT ON COLUMN admin_users.role IS '사용자 역할: student, consultant, admin';

COMMENT ON TABLE student_consulting_notes IS '학생별 상담노트를 저장하는 테이블';
COMMENT ON COLUMN student_consulting_notes.student_id IS '상담 대상 학생 ID';
COMMENT ON COLUMN student_consulting_notes.consultant_id IS '상담을 작성한 컨설턴트/관리자 ID';
COMMENT ON COLUMN student_consulting_notes.note IS '상담 내용';

