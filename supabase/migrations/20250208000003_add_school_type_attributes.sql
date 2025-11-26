-- Migration: Add School Type Attributes
-- Description: schools 테이블에 학교 타입별 속성 추가
-- Date: 2025-02-08

-- ============================================
-- 1. 고등학교 속성 추가
-- ============================================

-- category 컬럼 추가 (일반고/특목고/자사고/특성화고)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS category text;

-- category CHECK 제약조건 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'schools_category_check'
  ) THEN
    ALTER TABLE schools DROP CONSTRAINT schools_category_check;
  END IF;
END $$;

ALTER TABLE schools
ADD CONSTRAINT schools_category_check 
CHECK (category IS NULL OR category IN ('일반고', '특목고', '자사고', '특성화고'));

-- ============================================
-- 2. 대학교 속성 추가
-- ============================================

-- university_type 컬럼 추가 (4년제/2년제)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS university_type text;

-- university_type CHECK 제약조건 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'schools_university_type_check'
  ) THEN
    ALTER TABLE schools DROP CONSTRAINT schools_university_type_check;
  END IF;
END $$;

ALTER TABLE schools
ADD CONSTRAINT schools_university_type_check 
CHECK (university_type IS NULL OR university_type IN ('4년제', '2년제'));

-- university_ownership 컬럼 추가 (국립/사립)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS university_ownership text;

-- university_ownership CHECK 제약조건 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'schools_university_ownership_check'
  ) THEN
    ALTER TABLE schools DROP CONSTRAINT schools_university_ownership_check;
  END IF;
END $$;

ALTER TABLE schools
ADD CONSTRAINT schools_university_ownership_check 
CHECK (university_ownership IS NULL OR university_ownership IN ('국립', '사립'));

-- campus_name 컬럼 추가 (캠퍼스명)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS campus_name text;

-- ============================================
-- 3. 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_schools_category ON schools(category);
CREATE INDEX IF NOT EXISTS idx_schools_university_type ON schools(university_type);
CREATE INDEX IF NOT EXISTS idx_schools_university_ownership ON schools(university_ownership);

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON COLUMN schools.category IS '고등학교 유형: 일반고, 특목고, 자사고, 특성화고';
COMMENT ON COLUMN schools.university_type IS '대학교 유형: 4년제, 2년제';
COMMENT ON COLUMN schools.university_ownership IS '대학교 설립 유형: 국립, 사립';
COMMENT ON COLUMN schools.campus_name IS '대학교 캠퍼스명 (NULL 허용)';

