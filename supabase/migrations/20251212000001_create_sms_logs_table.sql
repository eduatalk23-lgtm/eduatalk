-- SMS 로그 테이블 생성
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  recipient_id uuid, -- 사용자 ID (students, admin_users, parent_users 등과 연동 가능)
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  template_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- recipient_id에 대한 외래 키는 users 테이블이 있는 경우에만 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    ALTER TABLE sms_logs
    ADD CONSTRAINT sms_logs_recipient_id_fkey 
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE sms_logs IS 'SMS 전송 로그 테이블';
COMMENT ON COLUMN sms_logs.status IS '발송 상태: pending(대기), sent(발송 완료), delivered(전달 완료), failed(실패)';

-- RLS 정책 설정
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 자신의 테넌트 내 모든 SMS 로그 조회 가능
CREATE POLICY "sms_logs_select_admin" ON sms_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = sms_logs.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생은 자신에게 발송된 SMS 로그만 조회 가능
CREATE POLICY "sms_logs_select_student" ON sms_logs
  FOR SELECT
  USING (
    recipient_id = auth.uid()
  );

-- 관리자만 SMS 로그 생성 가능
CREATE POLICY "sms_logs_insert_admin" ON sms_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = sms_logs.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 SMS 로그 수정 가능 (상태 업데이트 등)
CREATE POLICY "sms_logs_update_admin" ON sms_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = sms_logs.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant_id ON sms_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_id ON sms_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at);

