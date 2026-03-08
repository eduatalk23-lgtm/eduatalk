-- 학생 계정 연결/해제 이력 테이블
-- 누가 언제 어떤 학생 계정을 연결/해제했는지 추적

CREATE TABLE IF NOT EXISTS student_connection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('connected', 'disconnected')),
  performed_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스: 학생별 이력 조회
CREATE INDEX idx_connection_history_student ON student_connection_history (student_id, created_at DESC);

-- 인덱스: auth user별 이력 조회
CREATE INDEX idx_connection_history_auth_user ON student_connection_history (auth_user_id, created_at DESC);

-- RLS
ALTER TABLE student_connection_history ENABLE ROW LEVEL SECURITY;

-- 관리자/상담사만 조회 가능
CREATE POLICY connection_history_select ON student_connection_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- service_role만 INSERT 가능 (서버 액션에서 adminClient로 삽입)
CREATE POLICY connection_history_insert ON student_connection_history
  FOR INSERT TO service_role
  WITH CHECK (true);

COMMENT ON TABLE student_connection_history IS '학생 계정 연결/해제 이력 추적';
COMMENT ON COLUMN student_connection_history.student_id IS '현재 students.id (연결 해제 시 임시 UUID)';
COMMENT ON COLUMN student_connection_history.auth_user_id IS '연결/해제된 auth user의 ID';
COMMENT ON COLUMN student_connection_history.action IS 'connected: 초대 수락으로 연결, disconnected: 관리자에 의해 해제';
COMMENT ON COLUMN student_connection_history.performed_by IS '작업 수행자 (connected: 학생 본인, disconnected: 관리자)';
