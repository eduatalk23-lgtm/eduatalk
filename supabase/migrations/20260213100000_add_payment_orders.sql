-- =============================================
-- 일괄 결제(Batch Payment)를 위한 payment_orders 테이블
-- 여러 payment_records를 하나의 토스 결제로 묶는 주문 단위
-- =============================================

-- 1. payment_orders 테이블
CREATE TABLE payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  toss_order_id VARCHAR(64) UNIQUE NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','partial_refunded','refunded','cancelled')),
  toss_payment_key VARCHAR(200),
  toss_method VARCHAR(50),
  toss_receipt_url TEXT,
  toss_raw_response JSONB,
  toss_requested_at TIMESTAMPTZ,
  toss_approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payment_orders IS '일괄 결제 주문 (여러 payment_records를 하나의 토스 결제로 묶음)';
COMMENT ON COLUMN payment_orders.toss_order_id IS '토스페이먼츠 주문 ID (TLU-BATCH-{uuid})';
COMMENT ON COLUMN payment_orders.status IS 'pending=결제대기, paid=결제완료, partial_refunded=부분환불, refunded=전액환불, cancelled=취소';

-- 인덱스
CREATE INDEX idx_po_toss_order_id ON payment_orders(toss_order_id);
CREATE INDEX idx_po_tenant ON payment_orders(tenant_id);
CREATE INDEX idx_po_status ON payment_orders(status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();

-- RLS 활성화 (adminClient로 우회하므로 기본 정책만)
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- admin: tenant 기반 CRUD
CREATE POLICY po_admin_select ON payment_orders FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY po_admin_insert ON payment_orders FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY po_admin_update ON payment_orders FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY po_admin_delete ON payment_orders FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

-- parent: 연결 학생의 결제 주문만 SELECT 가능
CREATE POLICY po_parent_select ON payment_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_records pr
      JOIN student_parents sp ON sp.student_id = pr.student_id
      WHERE pr.payment_order_id = payment_orders.id
        AND sp.parent_user_id = auth.uid()
    )
  );

-- 2. payment_records에 payment_order_id FK 추가
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS payment_order_id UUID REFERENCES payment_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr_payment_order ON payment_records(payment_order_id)
  WHERE payment_order_id IS NOT NULL;

-- 3. confirm_batch_payment RPC 함수
-- 배치 주문 내 모든 payment_records를 일괄 결제 완료 처리
-- Supabase JS로는 "SET paid_amount = amount" 불가하므로 SQL 함수 필요
CREATE OR REPLACE FUNCTION confirm_batch_payment(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE payment_records
  SET
    status = 'paid',
    paid_amount = amount,
    paid_date = CURRENT_DATE::TEXT,
    payment_method = 'card',
    updated_at = NOW()
  WHERE payment_order_id = p_order_id
    AND status IN ('unpaid', 'partial');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION confirm_batch_payment IS '배치 주문 내 모든 미납 payment_records를 paid로 일괄 업데이트';
