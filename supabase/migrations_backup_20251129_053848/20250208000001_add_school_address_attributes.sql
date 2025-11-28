-- Migration: Add School Address Attributes
-- Description: schools 테이블에 상세 주소 속성 추가
-- Date: 2025-02-08

-- ============================================
-- 1. schools 테이블에 주소 관련 컬럼 추가
-- ============================================

-- 우편번호 컬럼 추가
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS postal_code text;

-- 상세주소 컬럼 추가 (건물명, 동/호수 등)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS address_detail text;

-- 시/군/구 컬럼 추가
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS city text;

-- 읍/면/동 컬럼 추가 (선택사항)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS district text;

-- ============================================
-- 2. 우편번호 형식 검증을 위한 CHECK 제약조건 (선택사항)
-- ============================================
-- 주의: 우편번호 형식은 애플리케이션 레벨에서 검증하는 것을 권장
-- 데이터베이스 레벨에서는 NULL 또는 5-6자리 숫자만 허용하는 제약조건 추가 가능

-- ============================================
-- 3. 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_schools_city ON schools(city);
CREATE INDEX IF NOT EXISTS idx_schools_postal_code ON schools(postal_code);

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON COLUMN schools.postal_code IS '우편번호 (5자리 또는 6자리)';
COMMENT ON COLUMN schools.address_detail IS '상세주소 (건물명, 동/호수 등)';
COMMENT ON COLUMN schools.city IS '시/군/구';
COMMENT ON COLUMN schools.district IS '읍/면/동 (선택사항)';
COMMENT ON COLUMN schools.address IS '기본주소 (기존 컬럼, 시/도 + 시/군/구)';

