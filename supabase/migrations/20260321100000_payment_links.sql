-- Payment Links: 게스트 결제 링크 테이블
-- 관리자가 생성 → 학부모가 로그인 없이 결제 링크로 접속 → 결제

CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,                     -- nanoid(21), URL용
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_record_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- 게스트 페이지용 비정규화 (join 없이 표시)
  academy_name TEXT NOT NULL,
  student_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  amount INTEGER NOT NULL,                        -- 링크 생성 시점 금액
  due_date DATE,
  memo TEXT,

  -- 링크 상태
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,

  -- 발송 추적
  delivery_method TEXT CHECK (delivery_method IN ('alimtalk', 'sms', 'manual')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
  delivered_at TIMESTAMPTZ,
  recipient_phone TEXT,

  -- 결제 완료
  paid_at TIMESTAMPTZ,
  toss_payment_key TEXT,

  -- 접근 추적
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- 메타
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_token ON payment_links(token);
CREATE INDEX IF NOT EXISTS idx_payment_links_payment_record ON payment_links(payment_record_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_tenant_status ON payment_links(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_links_expires_active
  ON payment_links(expires_at) WHERE status = 'active';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE TRIGGER set_payment_links_updated_at
  BEFORE UPDATE ON payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- 관리자: tenant 기준 CRUD
CREATE POLICY "admin_payment_links_select" ON payment_links
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "admin_payment_links_insert" ON payment_links
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "admin_payment_links_update" ON payment_links
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "admin_payment_links_delete" ON payment_links
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE payment_links IS '게스트 결제 링크 — 학부모가 로그인 없이 결제할 수 있는 일회성 링크';
COMMENT ON COLUMN payment_links.token IS 'nanoid(21) URL 토큰 — /pay/{token}';
COMMENT ON COLUMN payment_links.amount IS '링크 생성 시점의 결제 금액 (변조 방지)';
