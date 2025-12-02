-- tenants 테이블에 status 컬럼 추가
-- 기존 데이터는 'active'로 설정

-- status 컬럼이 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tenants' 
      AND column_name = 'status'
  ) THEN
    -- status 컬럼 추가 (기본값: 'active')
    ALTER TABLE tenants 
    ADD COLUMN status text DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'suspended'));
    
    -- 기존 데이터의 status를 'active'로 설정
    UPDATE tenants 
    SET status = 'active' 
    WHERE status IS NULL;
    
    -- 컬럼 코멘트 추가
    COMMENT ON COLUMN tenants.status IS '기관 상태: active(활성), inactive(비활성), suspended(정지)';
  END IF;
END $$;

