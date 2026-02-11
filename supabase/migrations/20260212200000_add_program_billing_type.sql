-- programs에 청구 방식 추가 (price_unit 기반으로 기본값 세팅)
ALTER TABLE programs
  ADD COLUMN billing_type text NOT NULL DEFAULT 'recurring';

COMMENT ON COLUMN programs.billing_type IS 'recurring=매월자동, one_time=1회, manual=수동';

-- 기존 데이터: price_unit에 따라 billing_type 자동 매핑
UPDATE programs SET billing_type = 'one_time' WHERE price_unit = 'total';
UPDATE programs SET billing_type = 'one_time' WHERE price_unit = 'per_session';
