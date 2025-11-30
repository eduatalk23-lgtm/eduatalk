-- ============================================================================
-- 마이그레이션: master_books 테이블 스키마 복원
-- 작성일: 2025-01-01
-- 설명: Supabase에서 수동으로 잘못 수정된 master_books 테이블을 
--       마이그레이션 기준(20251130005859_restructure_master_books_schema.sql)으로 복원
-- ============================================================================

-- ============================================================================
-- STEP 1: 누락된 컬럼 추가 (IF NOT EXISTS로 안전하게)
-- ============================================================================

-- 기본 정보
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 교육과정 관련
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS curriculum_revision_id uuid REFERENCES curriculum_revisions(id);
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id);
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS grade_min integer;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS grade_max integer;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS school_type text;

-- 교재 메타 정보
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS series_name text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES publishers(id);
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS publisher_name text;

-- ISBN 정보
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS isbn_10 text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS isbn_13 text;

-- 출판 정보
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS edition text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS published_date date;

-- 추가 교육 메타 정보
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS target_exam_type text[];

-- 설명 및 리뷰
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS toc text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS publisher_review text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS tags text[];

-- 출처 정보
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS source_product_code text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE master_books ADD COLUMN IF NOT EXISTS cover_image_url text;

-- ============================================================================
-- STEP 2: 컬럼 타입 및 제약조건 복원
-- ============================================================================

-- total_pages 컬럼의 NOT NULL 제약 제거 (이미 NULL 허용이면 변경 없음)
ALTER TABLE master_books ALTER COLUMN total_pages DROP NOT NULL;

-- title 컬럼 타입 변경 (varchar → text, 이미 text면 변경 없음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_books' 
    AND column_name = 'title' 
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE master_books ALTER COLUMN title TYPE text;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: 제약조건 복원 (기존 제약조건이 있으면 삭제 후 재생성)
-- ============================================================================

-- 학년 범위 CHECK 제약
ALTER TABLE master_books DROP CONSTRAINT IF EXISTS master_books_grade_min_check;
ALTER TABLE master_books ADD CONSTRAINT master_books_grade_min_check 
  CHECK (grade_min IS NULL OR (grade_min BETWEEN 1 AND 3));

ALTER TABLE master_books DROP CONSTRAINT IF EXISTS master_books_grade_max_check;
ALTER TABLE master_books ADD CONSTRAINT master_books_grade_max_check 
  CHECK (grade_max IS NULL OR (grade_max BETWEEN 1 AND 3));

-- 학교 유형 CHECK 제약
ALTER TABLE master_books DROP CONSTRAINT IF EXISTS master_books_school_type_check;
ALTER TABLE master_books ADD CONSTRAINT master_books_school_type_check 
  CHECK (school_type IS NULL OR school_type IN ('MIDDLE','HIGH','OTHER'));

-- ISBN-13 UNIQUE 제약
ALTER TABLE master_books DROP CONSTRAINT IF EXISTS master_books_isbn_13_unique;
ALTER TABLE master_books ADD CONSTRAINT master_books_isbn_13_unique 
  UNIQUE (isbn_13);

-- ============================================================================
-- STEP 4: Foreign Key 제약조건 확인 및 복원
-- ============================================================================

-- curriculum_revision_id FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_curriculum_revision_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    ADD CONSTRAINT master_books_curriculum_revision_id_fkey 
    FOREIGN KEY (curriculum_revision_id) REFERENCES curriculum_revisions(id);
  END IF;
END $$;

-- subject_id FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_subject_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    ADD CONSTRAINT master_books_subject_id_fkey 
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
  END IF;
END $$;

-- publisher_id FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_publisher_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    ADD CONSTRAINT master_books_publisher_id_fkey 
    FOREIGN KEY (publisher_id) REFERENCES publishers(id);
  END IF;
END $$;

-- ============================================================================
-- STEP 5: 삭제되어서는 안 되는 컬럼 확인 (레거시 컬럼이 남아있으면 경고)
-- ============================================================================

-- subject_category, subject, publisher 컬럼이 남아있으면 경고 (수동으로 삭제 필요)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_books' AND column_name = 'subject_category'
  ) THEN
    RAISE WARNING 'subject_category 컬럼이 아직 존재합니다. 마이그레이션 기준에 따라 삭제되어야 합니다.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_books' AND column_name = 'subject'
  ) THEN
    RAISE WARNING 'subject 컬럼이 아직 존재합니다. 마이그레이션 기준에 따라 삭제되어야 합니다.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_books' AND column_name = 'publisher'
  ) THEN
    RAISE WARNING 'publisher 컬럼이 아직 존재합니다. 마이그레이션 기준에 따라 삭제되어야 합니다.';
  END IF;
END $$;

-- ============================================================================
-- 변경 내역 요약
-- ============================================================================
-- 
-- 이 마이그레이션은 다음을 수행합니다:
-- 
-- 1. 누락된 컬럼 추가 (22개):
--    - is_active, curriculum_revision_id, subject_id
--    - grade_min, grade_max, school_type
--    - subtitle, series_name, author
--    - publisher_id, publisher_name
--    - isbn_10, isbn_13
--    - edition, published_date
--    - target_exam_type
--    - description, toc, publisher_review
--    - tags
--    - source, source_product_code, source_url
--    - cover_image_url
-- 
-- 2. 컬럼 타입 및 제약조건 복원:
--    - total_pages: NOT NULL 제거
--    - title: varchar → text
-- 
-- 3. 제약조건 복원:
--    - CHECK: grade_min, grade_max, school_type
--    - UNIQUE: isbn_13
--    - FOREIGN KEY: curriculum_revision_id, subject_id, publisher_id
-- 
-- 4. 레거시 컬럼 확인:
--    - subject_category, subject, publisher가 남아있으면 경고
--    - (수동으로 삭제 필요: ALTER TABLE master_books DROP COLUMN IF EXISTS subject_category; 등)
-- 
-- ============================================================================

