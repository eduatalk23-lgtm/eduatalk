-- ============================================================================
-- 마이그레이션: master_books, book_details, content_master_details 스키마 재정리
-- 작성일: 2025-11-30
-- 설명: 교재 관련 테이블의 스키마를 새로운 DDL에 맞춰 재구성
--       모든 기존 데이터는 삭제되며, 컬럼 추가/제거 및 제약조건 재설정
-- ============================================================================

-- ============================================================================
-- STEP 1: 의존 데이터 정리 (CASCADE)
-- ============================================================================
-- 참고: master_books를 참조하는 테이블들의 데이터를 먼저 정리합니다.
--       - books.master_content_id (ON DELETE SET NULL)
--       - master_lectures.linked_book_id (ON DELETE SET NULL)
--       - book_details.book_id (ON DELETE CASCADE)

TRUNCATE TABLE book_details CASCADE;
TRUNCATE TABLE books CASCADE;
TRUNCATE TABLE master_lectures CASCADE;
TRUNCATE TABLE master_books CASCADE;

-- ============================================================================
-- STEP 2: master_books 테이블 스키마 변경
-- ============================================================================

-- 2-1. 기존 컬럼 삭제 (더 이상 사용하지 않는 컬럼)
ALTER TABLE master_books DROP COLUMN IF EXISTS subject_category;
ALTER TABLE master_books DROP COLUMN IF EXISTS subject;
ALTER TABLE master_books DROP COLUMN IF EXISTS publisher;

-- 2-2. 새로운 컬럼 추가
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

-- 2-3. total_pages 컬럼의 NOT NULL 제약 제거 (유연성 확보)
ALTER TABLE master_books ALTER COLUMN total_pages DROP NOT NULL;

-- 2-4. title 컬럼 타입 변경 (varchar → text)
ALTER TABLE master_books ALTER COLUMN title TYPE text;

-- 2-5. 제약조건 추가

-- 기존 total_pages CHECK 제약이 있으면 그대로 유지 (이미 존재)
-- ALTER TABLE master_books ADD CONSTRAINT master_books_total_pages_check CHECK (total_pages > 0);

-- 학년 범위 CHECK 제약
ALTER TABLE master_books ADD CONSTRAINT master_books_grade_min_check 
  CHECK (grade_min IS NULL OR (grade_min BETWEEN 1 AND 3));

ALTER TABLE master_books ADD CONSTRAINT master_books_grade_max_check 
  CHECK (grade_max IS NULL OR (grade_max BETWEEN 1 AND 3));

-- 학교 유형 CHECK 제약
ALTER TABLE master_books ADD CONSTRAINT master_books_school_type_check 
  CHECK (school_type IS NULL OR school_type IN ('MIDDLE','HIGH','OTHER'));

-- ISBN-13 UNIQUE 제약
ALTER TABLE master_books ADD CONSTRAINT master_books_isbn_13_unique 
  UNIQUE (isbn_13);

-- ============================================================================
-- STEP 3: book_details 테이블 UNIQUE 제약 변경
-- ============================================================================

-- 3-1. 기존 UNIQUE 제약 삭제
ALTER TABLE book_details DROP CONSTRAINT IF EXISTS book_details_book_page_unique;

-- 3-2. 새 UNIQUE 제약 추가 (book_id, display_order)
ALTER TABLE book_details ADD CONSTRAINT book_details_book_id_display_order_key 
  UNIQUE (book_id, display_order);

-- ============================================================================
-- STEP 4: content_master_details 테이블 UNIQUE 제약 변경
-- ============================================================================

-- 4-1. 기존 UNIQUE 제약 삭제
ALTER TABLE content_master_details DROP CONSTRAINT IF EXISTS content_master_details_master_page_unique;

-- 4-2. 새 UNIQUE 제약 추가 (master_id, display_order)
ALTER TABLE content_master_details ADD CONSTRAINT content_master_details_master_id_display_order_key 
  UNIQUE (master_id, display_order);

-- ============================================================================
-- 변경 내역 요약
-- ============================================================================
-- 
-- [master_books 테이블]
-- 
-- 삭제된 컬럼 (3개):
--   - subject_category (varchar)
--   - subject (varchar)
--   - publisher (varchar)
-- 
-- 추가된 컬럼 (22개):
--   - is_active (boolean, NOT NULL, DEFAULT true)
--   - curriculum_revision_id (uuid, FK → curriculum_revisions)
--   - subject_id (uuid, FK → subjects)
--   - grade_min (integer, CHECK: 1-3)
--   - grade_max (integer, CHECK: 1-3)
--   - school_type (text, CHECK: MIDDLE/HIGH/OTHER)
--   - subtitle (text)
--   - series_name (text)
--   - author (text)
--   - publisher_id (uuid, FK → publishers)
--   - publisher_name (text)
--   - isbn_10 (text)
--   - isbn_13 (text, UNIQUE)
--   - edition (text)
--   - published_date (date)
--   - target_exam_type (text[])
--   - description (text)
--   - toc (text)
--   - publisher_review (text)
--   - tags (text[])
--   - source (text)
--   - source_product_code (text)
--   - source_url (text)
--   - cover_image_url (text)
-- 
-- 변경된 제약조건:
--   - total_pages: NOT NULL 제거
--   - title: varchar → text
--   - 추가된 FK: curriculum_revision_id, subject_id, publisher_id
--   - 추가된 CHECK: grade_min, grade_max, school_type
--   - 추가된 UNIQUE: isbn_13
-- 
-- [book_details 테이블]
-- 
-- 변경된 제약조건:
--   - 기존: UNIQUE (book_id, page_number)
--   - 변경: UNIQUE (book_id, display_order)
-- 
-- [content_master_details 테이블]
-- 
-- 변경된 제약조건:
--   - 기존: UNIQUE (master_id, page_number)
--   - 변경: UNIQUE (master_id, display_order)
-- 
-- ============================================================================
-- 주의사항
-- ============================================================================
-- 1. 이 마이그레이션은 모든 교재 관련 데이터를 삭제합니다.
-- 2. 운영 환경이 아닌 개발/테스트 환경에서만 실행하세요.
-- 3. 애플리케이션 코드에서 삭제된 컬럼(subject_category, subject, publisher) 
--    참조를 제거해야 합니다.
-- 4. FK 참조 테이블(curriculum_revisions, subjects, publishers)이 
--    미리 존재해야 합니다.
-- ============================================================================

