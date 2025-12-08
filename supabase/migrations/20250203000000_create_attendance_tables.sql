-- updated_at 자동 업데이트 함수 (없는 경우에만 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 출석 기록 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_method text CHECK (check_in_method IN ('manual', 'qr', 'location', 'auto')),
  check_out_method text CHECK (check_out_method IN ('manual', 'qr', 'location', 'auto')),
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'excused')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);

COMMENT ON TABLE attendance_records IS '입실/퇴실 기록 테이블';
COMMENT ON COLUMN attendance_records.check_in_method IS '입실 방법: manual(수동), qr(QR코드), location(위치기반), auto(자동)';
COMMENT ON COLUMN attendance_records.check_out_method IS '퇴실 방법: manual(수동), qr(QR코드), location(위치기반), auto(자동)';
COMMENT ON COLUMN attendance_records.status IS '출석 상태: present(출석), absent(결석), late(지각), early_leave(조퇴), excused(공결)';

-- RLS 정책 설정
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 테넌트 내 모든 출석 기록 조회 가능
CREATE POLICY "attendance_records_select_admin" ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_records.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생은 자신의 출석 기록만 조회 가능
CREATE POLICY "attendance_records_select_student" ON attendance_records
  FOR SELECT
  USING (
    student_id = auth.uid()
  );

-- 학부모는 자녀의 출석 기록 조회 가능
CREATE POLICY "attendance_records_select_parent" ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_parent_links
      WHERE student_parent_links.student_id = attendance_records.student_id
      AND student_parent_links.parent_id = auth.uid()
      AND student_parent_links.is_approved = true
    )
  );

-- 관리자만 출석 기록 생성/수정 가능
CREATE POLICY "attendance_records_insert_admin" ON attendance_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_records.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

CREATE POLICY "attendance_records_update_admin" ON attendance_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_records.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

CREATE POLICY "attendance_records_delete_admin" ON attendance_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_records.tenant_id
      AND admin_users.role = 'admin'
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_id ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_attendance_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date ON attendance_records(student_id, attendance_date);

