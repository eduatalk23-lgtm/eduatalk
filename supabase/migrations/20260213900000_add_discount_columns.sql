-- 수납 할인 기능: original_amount, discount_type, discount_value 컬럼 추가
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS original_amount integer,
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('fixed', 'rate')),
  ADD COLUMN IF NOT EXISTS discount_value numeric CHECK (discount_value >= 0);

-- 할인 필드 일관성: 셋 다 NULL이거나 셋 다 NOT NULL
ALTER TABLE payment_records
  ADD CONSTRAINT chk_discount_fields_consistent CHECK (
    (discount_type IS NULL AND discount_value IS NULL AND original_amount IS NULL) OR
    (discount_type IS NOT NULL AND discount_value IS NOT NULL AND original_amount IS NOT NULL)
  );

-- 비율 할인은 0~100 범위
ALTER TABLE payment_records
  ADD CONSTRAINT chk_discount_rate_range
  CHECK (discount_type != 'rate' OR (discount_value >= 0 AND discount_value <= 100));
