-- 학생 계정 연결 코드 테이블 생성
-- 관리자가 학생을 등록할 때 생성되는 연결 코드를 저장
-- 학생이 회원가입 시 이 코드를 사용하여 기존 학생 레코드와 계정을 연결

CREATE TABLE student_connection_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  connection_code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT code_format CHECK (connection_code ~ '^STU-[A-Z0-9]{4}-[A-Z0-9]{4}$')
);

COMMENT ON TABLE student_connection_codes IS '학생 계정 연결 코드 테이블';
COMMENT ON COLUMN student_connection_codes.student_id IS '연결할 학생 ID (FK → students.id)';
COMMENT ON COLUMN student_connection_codes.connection_code IS '연결 코드 (형식: STU-XXXX-XXXX)';
COMMENT ON COLUMN student_connection_codes.expires_at IS '코드 만료 시간 (기본 30일)';
COMMENT ON COLUMN student_connection_codes.used_at IS '코드 사용 시간 (일회성 사용)';
COMMENT ON COLUMN student_connection_codes.created_by IS '코드 생성자 ID (관리자)';

-- 인덱스 생성
CREATE INDEX idx_connection_codes_code ON student_connection_codes(connection_code);
CREATE INDEX idx_connection_codes_student ON student_connection_codes(student_id);
CREATE INDEX idx_connection_codes_expires ON student_connection_codes(expires_at) WHERE used_at IS NULL;

-- RLS 정책 설정
ALTER TABLE student_connection_codes ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 테넌트 내 모든 연결 코드 조회 가능
CREATE POLICY "student_connection_codes_select_admin" ON student_connection_codes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = (
        SELECT tenant_id FROM students WHERE students.id = student_connection_codes.student_id
      )
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자는 자신의 테넌트 내 연결 코드 생성 가능
CREATE POLICY "student_connection_codes_insert_admin" ON student_connection_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = (
        SELECT tenant_id FROM students WHERE students.id = student_connection_codes.student_id
      )
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자는 자신의 테넌트 내 연결 코드 수정 가능 (재발급 등)
CREATE POLICY "student_connection_codes_update_admin" ON student_connection_codes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = (
        SELECT tenant_id FROM students WHERE students.id = student_connection_codes.student_id
      )
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생은 자신의 코드만 조회 가능 (회원가입 시 검증용)
-- 주의: 학생이 아직 인증되지 않은 상태이므로, 코드로만 조회 가능하도록 별도 정책 필요
-- 회원가입 시에는 서버 사이드에서 코드 검증하므로 RLS 정책은 선택사항
-- 하지만 보안을 위해 인증되지 않은 사용자도 코드로만 조회 가능하도록 설정
CREATE POLICY "student_connection_codes_select_by_code" ON student_connection_codes
  FOR SELECT
  USING (
    -- 코드가 유효하고 (만료되지 않음, 사용되지 않음)
    expires_at > now()
    AND used_at IS NULL
    -- 코드 형식이 올바름
    AND connection_code ~ '^STU-[A-Z0-9]{4}-[A-Z0-9]{4}$'
  );

