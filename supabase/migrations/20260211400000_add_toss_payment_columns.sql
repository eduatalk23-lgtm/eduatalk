-- 토스페이먼츠 결제 연동을 위한 컬럼 추가
-- payment_records 테이블에 토스 결제 정보 저장용 컬럼 추가

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS toss_order_id varchar(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS toss_payment_key varchar(200),
  ADD COLUMN IF NOT EXISTS toss_method varchar(50),
  ADD COLUMN IF NOT EXISTS toss_receipt_url text,
  ADD COLUMN IF NOT EXISTS toss_raw_response jsonb,
  ADD COLUMN IF NOT EXISTS toss_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS toss_approved_at timestamptz;

-- 인덱스: orderId로 빠르게 조회 (결제 승인 시)
CREATE INDEX IF NOT EXISTS idx_payment_records_toss_order_id
  ON payment_records (toss_order_id)
  WHERE toss_order_id IS NOT NULL;

-- 인덱스: paymentKey로 빠르게 조회 (환불/조회 시)
CREATE INDEX IF NOT EXISTS idx_payment_records_toss_payment_key
  ON payment_records (toss_payment_key)
  WHERE toss_payment_key IS NOT NULL;
