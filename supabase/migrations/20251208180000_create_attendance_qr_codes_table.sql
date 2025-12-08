-- 출석용 QR 코드 테이블 생성
CREATE TABLE attendance_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  qr_data text NOT NULL,
  qr_code_url text,
  is_active boolean DEFAULT true,
  expires_at timestamptz NOT NULL,
  created_by uuid, -- 사용자 ID (users 테이블 참조 제거, auth.uid() 사용)
  created_at timestamptz DEFAULT now(),
  deactivated_at timestamptz,
  deactivated_by uuid, -- 사용자 ID (users 테이블 참조 제거, auth.uid() 사용)
  usage_count integer DEFAULT 0,
  last_used_at timestamptz
);

COMMENT ON TABLE attendance_qr_codes IS '출석용 QR 코드 관리 테이블';
COMMENT ON COLUMN attendance_qr_codes.qr_data IS 'QR 코드 데이터 (JSON 문자열)';
COMMENT ON COLUMN attendance_qr_codes.qr_code_url IS 'QR 코드 이미지 URL (Data URL, 선택적)';
COMMENT ON COLUMN attendance_qr_codes.is_active IS '활성 상태 (true: 활성, false: 비활성)';
COMMENT ON COLUMN attendance_qr_codes.expires_at IS 'QR 코드 만료 시간';
COMMENT ON COLUMN attendance_qr_codes.created_by IS 'QR 코드 생성자 ID';
COMMENT ON COLUMN attendance_qr_codes.deactivated_at IS '비활성화 시간';
COMMENT ON COLUMN attendance_qr_codes.deactivated_by IS '비활성화한 사용자 ID';
COMMENT ON COLUMN attendance_qr_codes.usage_count IS 'QR 코드 사용 횟수';
COMMENT ON COLUMN attendance_qr_codes.last_used_at IS '마지막 사용 시간';

-- RLS 정책 설정
ALTER TABLE attendance_qr_codes ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 테넌트 내 모든 QR 코드 조회 가능
CREATE POLICY "attendance_qr_codes_select_admin" ON attendance_qr_codes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 QR 코드 생성 가능
CREATE POLICY "attendance_qr_codes_insert_admin" ON attendance_qr_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 QR 코드 수정 가능 (비활성화, 사용 통계 업데이트)
CREATE POLICY "attendance_qr_codes_update_admin" ON attendance_qr_codes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생은 활성 QR 코드만 조회 가능 (검증용)
CREATE POLICY "attendance_qr_codes_select_student" ON attendance_qr_codes
  FOR SELECT
  USING (
    is_active = true
    AND expires_at > now()
    AND EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.tenant_id = attendance_qr_codes.tenant_id
    )
  );

-- 인덱스 생성
CREATE INDEX idx_attendance_qr_codes_tenant_id ON attendance_qr_codes(tenant_id);
CREATE INDEX idx_attendance_qr_codes_active ON attendance_qr_codes(tenant_id, is_active, expires_at) 
  WHERE is_active = true;
CREATE INDEX idx_attendance_qr_codes_created_at ON attendance_qr_codes(tenant_id, created_at DESC);

