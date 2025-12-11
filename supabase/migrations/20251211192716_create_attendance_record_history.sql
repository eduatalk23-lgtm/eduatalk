-- 출석 기록 수정 이력 테이블 생성
CREATE TABLE attendance_record_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- 수정 전 데이터 (원본 백업)
  before_data jsonb NOT NULL,
  
  -- 수정 후 데이터
  after_data jsonb NOT NULL,
  
  -- 수정 정보
  modified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  modified_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL, -- 수정 사유 (필수)
  
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_attendance_record_history_record_id 
  ON attendance_record_history(attendance_record_id);
CREATE INDEX idx_attendance_record_history_student_id 
  ON attendance_record_history(student_id);
CREATE INDEX idx_attendance_record_history_modified_at 
  ON attendance_record_history(modified_at DESC);

-- RLS 정책
ALTER TABLE attendance_record_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자는 자신의 테넌트 내 출석 기록 수정 이력을 조회할 수 있음"
  ON attendance_record_history
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- 관리자는 자신의 테넌트 내 출석 기록 수정 이력을 생성할 수 있음
CREATE POLICY "관리자는 자신의 테넌트 내 출석 기록 수정 이력을 생성할 수 있음"
  ON attendance_record_history
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE attendance_record_history IS '출석 기록 수정 이력 테이블';
COMMENT ON COLUMN attendance_record_history.before_data IS '수정 전 원본 데이터 (JSONB)';
COMMENT ON COLUMN attendance_record_history.after_data IS '수정 후 데이터 (JSONB)';
COMMENT ON COLUMN attendance_record_history.reason IS '수정 사유 (필수)';

