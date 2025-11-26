-- Migration: Add School Code
-- Description: schools 테이블에 학교 코드(식별자) 추가
-- Date: 2025-02-08

-- ============================================
-- 1. schools 테이블에 school_code 컬럼 추가
-- ============================================

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS school_code text;

-- ============================================
-- 2. UNIQUE 제약조건 추가
-- ============================================

-- school_code에 UNIQUE 제약조건 추가 (NULL 값은 중복 허용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'schools_school_code_unique'
  ) THEN
    -- NULL 값은 UNIQUE 제약조건에서 제외되므로, 부분 인덱스 사용
    CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_school_code_unique 
    ON schools(school_code) 
    WHERE school_code IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 3. 인덱스 추가 (검색 성능 향상)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_schools_school_code ON schools(school_code);

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON COLUMN schools.school_code IS '학교 고유 식별자 (교육청 코드 등), UNIQUE';

