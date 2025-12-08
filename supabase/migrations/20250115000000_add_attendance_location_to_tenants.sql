-- tenants 테이블에 출석 관련 위치 정보 및 QR 코드 시크릿 추가

-- 위치 정보 컬럼 추가
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS location_latitude numeric(10, 8),
ADD COLUMN IF NOT EXISTS location_longitude numeric(11, 8),
ADD COLUMN IF NOT EXISTS location_radius_meters integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS qr_code_secret text;

-- 컬럼 설명 추가
COMMENT ON COLUMN tenants.location_latitude IS '학원 위도 (위도 범위: -90 ~ 90)';
COMMENT ON COLUMN tenants.location_longitude IS '학원 경도 (경도 범위: -180 ~ 180)';
COMMENT ON COLUMN tenants.location_radius_meters IS '출석 인정 반경 (미터 단위, 기본값: 100m)';
COMMENT ON COLUMN tenants.qr_code_secret IS 'QR 코드 검증용 시크릿 키 (선택사항)';

-- 위치 정보 제약 조건 추가
ALTER TABLE tenants
ADD CONSTRAINT check_latitude_range CHECK (
  location_latitude IS NULL OR (location_latitude >= -90 AND location_latitude <= 90)
);

ALTER TABLE tenants
ADD CONSTRAINT check_longitude_range CHECK (
  location_longitude IS NULL OR (location_longitude >= -180 AND location_longitude <= 180)
);

ALTER TABLE tenants
ADD CONSTRAINT check_radius_positive CHECK (
  location_radius_meters IS NULL OR location_radius_meters > 0
);

