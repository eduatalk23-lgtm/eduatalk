-- Migration: Add Region Hierarchy
-- Description: regions 테이블에 위계 구조 추가 (시/도 → 시/군/구 → 읍/면/동)
-- Date: 2025-02-08

-- ============================================
-- 1. regions 테이블에 위계 속성 컬럼 추가
-- ============================================

-- parent_id 컬럼 추가 (상위 지역 ID)
ALTER TABLE regions
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES regions(id) ON DELETE SET NULL;

-- level 컬럼 추가 (지역 레벨: 1=시/도, 2=시/군/구, 3=읍/면/동)
ALTER TABLE regions
ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

-- code 컬럼 추가 (행정구역 코드, 선택사항)
ALTER TABLE regions
ADD COLUMN IF NOT EXISTS code text;

-- ============================================
-- 2. 기존 데이터 마이그레이션
-- ============================================

-- 기존 지역 데이터는 모두 level 1(시/도)로 설정
UPDATE regions
SET level = 1
WHERE level IS NULL OR level = 0;

-- ============================================
-- 3. 제약조건 추가
-- ============================================

-- level CHECK 제약조건 (1, 2, 3만 허용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'regions_level_check'
  ) THEN
    ALTER TABLE regions
    ADD CONSTRAINT regions_level_check 
    CHECK (level IN (1, 2, 3));
  END IF;
END $$;

-- 순환 참조 방지 CHECK 제약조건
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'regions_no_self_reference_check'
  ) THEN
    ALTER TABLE regions
    ADD CONSTRAINT regions_no_self_reference_check 
    CHECK (parent_id IS NULL OR parent_id != id);
  END IF;
END $$;

-- ============================================
-- 4. 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_regions_parent_id ON regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);

-- ============================================
-- 5. 코멘트 추가
-- ============================================

COMMENT ON COLUMN regions.parent_id IS '상위 지역 ID (FK → regions), 시/도 → 시/군/구 → 읍/면/동 위계 구조';
COMMENT ON COLUMN regions.level IS '지역 레벨: 1=시/도, 2=시/군/구, 3=읍/면/동';
COMMENT ON COLUMN regions.code IS '행정구역 코드 (선택사항)';

