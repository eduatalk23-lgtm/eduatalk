-- tenant_scheduler_settings 테이블에 review_time_ratio 컬럼 추가
-- 복습일 소요시간 비율 설정 (기본값: 0.5 = 50%)

ALTER TABLE tenant_scheduler_settings
ADD COLUMN IF NOT EXISTS review_time_ratio NUMERIC(3, 2) DEFAULT 0.5 
CHECK (review_time_ratio > 0 AND review_time_ratio <= 1);

COMMENT ON COLUMN tenant_scheduler_settings.review_time_ratio IS 
'복습일 소요시간 비율 (학습일 대비). 예: 0.5 = 50%, 0.3 = 30%';

