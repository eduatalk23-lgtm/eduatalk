-- Migration: Make schools global and add regions table
-- Description: schools 테이블을 전역 관리로 변경하고 regions 테이블 추가
-- Date: 2025-02-07

-- ============================================
-- 1. regions 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE regions IS '지역 테이블 (전역 관리)';
COMMENT ON COLUMN regions.name IS '지역명 (예: 서울특별시, 부산광역시)';
COMMENT ON COLUMN regions.display_order IS '표시 순서';

-- ============================================
-- 2. schools 테이블 생성 또는 확인
-- ============================================

-- schools 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('중학교', '고등학교', '대학교')),
  region text,
  address text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE schools IS '학교 정보 테이블';

-- ============================================
-- 3. schools 테이블 스키마 변경
-- ============================================

-- 3-1. region_id 컬럼 추가 (NULL 허용, 나중에 데이터 마이그레이션에서 채움)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

-- 3-2. display_order 컬럼 추가
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- 3-3. type CHECK 제약조건 변경
-- 기존 제약조건 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'schools_type_check'
  ) THEN
    ALTER TABLE schools DROP CONSTRAINT schools_type_check;
  END IF;
END $$;

-- 새로운 제약조건 추가 (한글 값)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'schools_type_check'
  ) THEN
    ALTER TABLE schools
    ADD CONSTRAINT schools_type_check 
    CHECK (type IN ('중학교', '고등학교', '대학교'));
  END IF;
END $$;

-- 3-4. 기존 region 텍스트 데이터를 regions 테이블로 마이그레이션
-- 중복 제거하여 regions 테이블에 삽입
INSERT INTO regions (name, display_order)
SELECT DISTINCT 
  region,
  ROW_NUMBER() OVER (ORDER BY region) as display_order
FROM schools
WHERE region IS NOT NULL 
  AND region != ''
  AND NOT EXISTS (SELECT 1 FROM regions WHERE regions.name = schools.region)
ON CONFLICT (name) DO NOTHING;

-- 3-5. 기존 schools 데이터의 region 텍스트를 region_id로 매칭
UPDATE schools s
SET region_id = r.id
FROM regions r
WHERE s.region = r.name
  AND s.region_id IS NULL;

-- 3-6. tenant_id 컬럼 제거 (전역 관리로 전환)
-- 주의: 기존 데이터가 있다면 먼저 확인 필요
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schools' AND column_name = 'tenant_id'
  ) THEN
    -- FK 제약조건이 있다면 먼저 제거
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname LIKE '%schools_tenant_id%'
    ) THEN
      ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_tenant_id_fkey;
    END IF;
    
    ALTER TABLE schools DROP COLUMN tenant_id;
  END IF;
END $$;

-- ============================================
-- 4. students 테이블 school_id 컬럼 및 FK 제약조건 추가
-- ============================================

-- students 테이블이 존재하는 경우에만 실행
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'students'
  ) THEN
    -- students.school_id 컬럼 추가 (없는 경우)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'students' AND column_name = 'school_id'
    ) THEN
      ALTER TABLE students
      ADD COLUMN school_id uuid;
    END IF;

    -- students.school_id FK 제약조건 추가 (없는 경우)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'students_school_id_fkey'
    ) THEN
      ALTER TABLE students
      ADD CONSTRAINT students_school_id_fkey 
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================
-- 5. 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_schools_region_id ON schools(region_id);
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(type);
CREATE INDEX IF NOT EXISTS idx_schools_display_order ON schools(display_order);
CREATE INDEX IF NOT EXISTS idx_regions_display_order ON regions(display_order);

-- ============================================
-- 6. 코멘트 추가
-- ============================================

COMMENT ON COLUMN schools.region_id IS '지역 ID (FK → regions)';
COMMENT ON COLUMN schools.display_order IS '표시 순서';
COMMENT ON COLUMN schools.type IS '학교 타입: 중학교, 고등학교, 대학교';

