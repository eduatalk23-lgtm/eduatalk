-- 학생용 교재/강의 테이블 필드 추가 마이그레이션
-- 마스터 교재(master_books)와 마스터 강의(master_lectures)의 필드를 기준으로
-- 학생용 교재(books)와 강의(lectures) 테이블에 부족한 필드를 추가

-- ============================================
-- 1단계: books 테이블 필드 추가
-- ============================================

-- 기본 정보 필드
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS content_category character varying(20),
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS series_name text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS toc text,
  ADD COLUMN IF NOT EXISTS publisher_review text;

-- 출판사 관련 필드
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS publisher_id uuid,
  ADD COLUMN IF NOT EXISTS publisher_name text,
  ADD COLUMN IF NOT EXISTS isbn_10 text,
  ADD COLUMN IF NOT EXISTS isbn_13 text,
  ADD COLUMN IF NOT EXISTS edition text,
  ADD COLUMN IF NOT EXISTS published_date date;

-- 메타데이터 필드
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS curriculum_revision_id uuid,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS subject_group_id uuid,
  ADD COLUMN IF NOT EXISTS grade_min integer,
  ADD COLUMN IF NOT EXISTS grade_max integer,
  ADD COLUMN IF NOT EXISTS school_type text;

-- 출처 및 소스 필드
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_product_code text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 분석 및 기타 필드
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS target_exam_type text[],
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS ocr_data jsonb,
  ADD COLUMN IF NOT EXISTS page_analysis jsonb,
  ADD COLUMN IF NOT EXISTS overall_difficulty numeric(3,2),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 타임스탬프 타입 변경 (timestamp without time zone → timestamp with time zone)
-- 주의: 뷰나 규칙이 의존하는 경우 먼저 삭제해야 함
-- 기존 데이터는 자동으로 변환됨
-- 뷰 의존성 확인 및 처리
DO $$
BEGIN
  -- v_all_contents 뷰가 있는 경우 삭제 (나중에 재생성 필요)
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_all_contents' AND schemaname = 'public') THEN
    DROP VIEW IF EXISTS public.v_all_contents CASCADE;
  END IF;
END $$;

ALTER TABLE public.books
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'UTC';

-- 외래키 제약조건 추가
DO $$
BEGIN
  -- publisher_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_publisher_id_fkey'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_publisher_id_fkey
      FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;
  END IF;

  -- curriculum_revision_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_curriculum_revision_id_fkey'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_curriculum_revision_id_fkey
      FOREIGN KEY (curriculum_revision_id) REFERENCES public.curriculum_revisions(id) ON DELETE SET NULL;
  END IF;

  -- subject_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_subject_id_fkey'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;

  -- subject_group_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_subject_group_id_fkey'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_subject_group_id_fkey
      FOREIGN KEY (subject_group_id) REFERENCES public.subject_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- CHECK 제약조건 추가
DO $$
BEGIN
  -- grade_min, grade_max 체크
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_grade_min_check'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_grade_min_check
      CHECK (grade_min IS NULL OR (grade_min >= 1 AND grade_min <= 3));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_grade_max_check'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_grade_max_check
      CHECK (grade_max IS NULL OR (grade_max >= 1 AND grade_max <= 3));
  END IF;

  -- school_type 체크
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_school_type_check'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_school_type_check
      CHECK (school_type IS NULL OR (school_type = ANY (ARRAY['MIDDLE'::text, 'HIGH'::text, 'OTHER'::text])));
  END IF;

  -- isbn_13 unique (null은 허용)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'books_isbn_13_unique'
  ) THEN
    CREATE UNIQUE INDEX books_isbn_13_unique ON public.books(isbn_13) WHERE isbn_13 IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2단계: lectures 테이블 필드 추가
-- ============================================

-- 기본 정보 필드
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS content_category character varying(20),
  ADD COLUMN IF NOT EXISTS lecture_type character varying(50),
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS series_name text,
  ADD COLUMN IF NOT EXISTS instructor_name character varying(100),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS toc text;

-- 메타데이터 필드
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS curriculum_revision_id uuid,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS subject_group_id uuid,
  ADD COLUMN IF NOT EXISTS grade_level character varying(20),
  ADD COLUMN IF NOT EXISTS platform_id uuid;

-- 출처 및 소스 필드
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS lecture_source_url text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_product_code text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 분석 및 기타 필드
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS total_duration integer,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS episode_analysis jsonb,
  ADD COLUMN IF NOT EXISTS overall_difficulty numeric(3,2),
  ADD COLUMN IF NOT EXISTS target_exam_type text[],
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 타임스탬프 타입 변경 (timestamp without time zone → timestamp with time zone)
-- 주의: 뷰나 규칙이 의존하는 경우 먼저 삭제해야 함
-- v_all_contents 뷰는 이미 위에서 삭제됨 (CASCADE로 관련 뷰도 삭제됨)
ALTER TABLE public.lectures
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'UTC';

-- 외래키 제약조건 추가
DO $$
BEGIN
  -- curriculum_revision_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lectures_curriculum_revision_id_fkey'
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_curriculum_revision_id_fkey
      FOREIGN KEY (curriculum_revision_id) REFERENCES public.curriculum_revisions(id) ON DELETE SET NULL;
  END IF;

  -- subject_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lectures_subject_id_fkey'
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;

  -- subject_group_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lectures_subject_group_id_fkey'
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_subject_group_id_fkey
      FOREIGN KEY (subject_group_id) REFERENCES public.subject_groups(id) ON DELETE SET NULL;
  END IF;

  -- platform_id FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lectures_platform_id_fkey'
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_platform_id_fkey
      FOREIGN KEY (platform_id) REFERENCES public.platforms(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================
-- 3단계: 인덱스 추가
-- ============================================

-- books 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_books_publisher_id ON public.books(publisher_id);
CREATE INDEX IF NOT EXISTS idx_books_curriculum_revision_id ON public.books(curriculum_revision_id);
CREATE INDEX IF NOT EXISTS idx_books_subject_id ON public.books(subject_id);
CREATE INDEX IF NOT EXISTS idx_books_subject_group_id ON public.books(subject_group_id);
CREATE INDEX IF NOT EXISTS idx_books_source_url ON public.books(source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_is_active ON public.books(is_active);

-- lectures 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_lectures_curriculum_revision_id ON public.lectures(curriculum_revision_id);
CREATE INDEX IF NOT EXISTS idx_lectures_subject_id ON public.lectures(subject_id);
CREATE INDEX IF NOT EXISTS idx_lectures_subject_group_id ON public.lectures(subject_group_id);
CREATE INDEX IF NOT EXISTS idx_lectures_platform_id ON public.lectures(platform_id);
CREATE INDEX IF NOT EXISTS idx_lectures_lecture_source_url ON public.lectures(lecture_source_url) WHERE lecture_source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lectures_is_active ON public.lectures(is_active);

-- ============================================
-- 4단계: 데이터 마이그레이션 (선택사항)
-- 마스터 데이터에서 값 복사 (master_content_id 또는 master_lecture_id가 있는 경우)
-- ============================================

-- books 테이블: master_content_id가 있는 경우 마스터 데이터에서 값 복사
UPDATE public.books b
SET
  content_category = mb.content_category,
  subtitle = mb.subtitle,
  series_name = mb.series_name,
  author = mb.author,
  description = mb.description,
  toc = mb.toc,
  publisher_review = mb.publisher_review,
  publisher_id = mb.publisher_id,
  publisher_name = mb.publisher_name,
  isbn_10 = mb.isbn_10,
  isbn_13 = mb.isbn_13,
  edition = mb.edition,
  published_date = mb.published_date,
  curriculum_revision_id = mb.curriculum_revision_id,
  subject_id = mb.subject_id,
  subject_group_id = mb.subject_group_id,
  grade_min = mb.grade_min,
  grade_max = mb.grade_max,
  school_type = mb.school_type,
  source = mb.source,
  source_product_code = mb.source_product_code,
  source_url = mb.source_url,
  cover_image_url = mb.cover_image_url,
  target_exam_type = mb.target_exam_type,
  tags = mb.tags,
  pdf_url = mb.pdf_url,
  ocr_data = mb.ocr_data,
  page_analysis = mb.page_analysis,
  overall_difficulty = mb.overall_difficulty,
  is_active = mb.is_active
FROM public.master_books mb
WHERE b.master_content_id = mb.id
  AND b.master_content_id IS NOT NULL
  AND (
    -- 기존 필드가 null이거나 빈 값인 경우에만 업데이트
    b.content_category IS NULL OR
    b.subtitle IS NULL OR
    b.author IS NULL OR
    b.publisher_name IS NULL OR
    b.source_url IS NULL
  );

-- lectures 테이블: master_lecture_id가 있는 경우 마스터 데이터에서 값 복사
-- 주의: master_lectures 테이블의 실제 필드명 사용 (instructor, source_url 등)
-- 컬럼이 존재하는 경우에만 업데이트 실행
DO $$
BEGIN
  -- master_lecture_id 컬럼이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'lectures' 
      AND column_name = 'master_lecture_id'
  ) THEN
    UPDATE public.lectures l
    SET
      content_category = ml.content_category,
      subtitle = ml.subtitle,
      series_name = ml.series_name,
      instructor_name = ml.instructor, -- master_lectures는 instructor 필드 사용
      description = ml.description,
      toc = ml.toc,
      curriculum_revision_id = ml.curriculum_revision_id,
      subject_id = ml.subject_id,
      platform_id = ml.platform_id,
      lecture_source_url = ml.source_url, -- master_lectures는 source_url 필드 사용
      source = ml.source,
      source_product_code = ml.source_product_code,
      cover_image_url = ml.cover_image_url,
      total_duration = ml.total_duration,
      video_url = ml.video_url,
      transcript = ml.transcript,
      episode_analysis = ml.episode_analysis,
      overall_difficulty = ml.overall_difficulty,
      target_exam_type = ml.target_exam_type,
      tags = ml.tags,
      is_active = ml.is_active
    FROM public.master_lectures ml
    WHERE l.master_lecture_id = ml.id
      AND l.master_lecture_id IS NOT NULL
      AND (
        -- 기존 필드가 null이거나 빈 값인 경우에만 업데이트
        l.content_category IS NULL OR
        l.instructor_name IS NULL OR
        l.lecture_source_url IS NULL
      );
  END IF;
END $$;

-- 코멘트 추가
COMMENT ON COLUMN public.books.content_category IS '콘텐츠 카테고리';
COMMENT ON COLUMN public.books.subtitle IS '부제목';
COMMENT ON COLUMN public.books.series_name IS '시리즈명';
COMMENT ON COLUMN public.books.author IS '저자';
COMMENT ON COLUMN public.books.description IS '설명';
COMMENT ON COLUMN public.books.toc IS '목차';
COMMENT ON COLUMN public.books.publisher_review IS '출판사 리뷰';
COMMENT ON COLUMN public.books.publisher_id IS '출판사 ID (FK to publishers)';
COMMENT ON COLUMN public.books.publisher_name IS '출판사명 (denormalized)';
COMMENT ON COLUMN public.books.isbn_10 IS 'ISBN-10';
COMMENT ON COLUMN public.books.isbn_13 IS 'ISBN-13 (unique)';
COMMENT ON COLUMN public.books.edition IS '판본';
COMMENT ON COLUMN public.books.published_date IS '출판일';
COMMENT ON COLUMN public.books.curriculum_revision_id IS '교육과정 개정 ID (FK to curriculum_revisions)';
COMMENT ON COLUMN public.books.subject_id IS '과목 ID (FK to subjects)';
COMMENT ON COLUMN public.books.subject_group_id IS '교과 그룹 ID (FK to subject_groups)';
COMMENT ON COLUMN public.books.grade_min IS '최소 학년 (1-3)';
COMMENT ON COLUMN public.books.grade_max IS '최대 학년 (1-3)';
COMMENT ON COLUMN public.books.school_type IS '학교 유형 (MIDDLE, HIGH, OTHER)';
COMMENT ON COLUMN public.books.source IS '출처';
COMMENT ON COLUMN public.books.source_product_code IS '출처 상품 코드';
COMMENT ON COLUMN public.books.source_url IS '출처 URL';
COMMENT ON COLUMN public.books.cover_image_url IS '표지 이미지 URL';
COMMENT ON COLUMN public.books.target_exam_type IS '대상 시험 유형 배열';
COMMENT ON COLUMN public.books.tags IS '태그 배열';
COMMENT ON COLUMN public.books.pdf_url IS 'PDF URL';
COMMENT ON COLUMN public.books.ocr_data IS 'OCR 데이터';
COMMENT ON COLUMN public.books.page_analysis IS '페이지 분석 데이터';
COMMENT ON COLUMN public.books.overall_difficulty IS '전체 난이도';
COMMENT ON COLUMN public.books.is_active IS '활성화 여부';

COMMENT ON COLUMN public.lectures.content_category IS '콘텐츠 카테고리';
COMMENT ON COLUMN public.lectures.lecture_type IS '강의 유형';
COMMENT ON COLUMN public.lectures.subtitle IS '부제목';
COMMENT ON COLUMN public.lectures.series_name IS '시리즈명';
COMMENT ON COLUMN public.lectures.instructor_name IS '강사명';
COMMENT ON COLUMN public.lectures.description IS '설명';
COMMENT ON COLUMN public.lectures.toc IS '목차';
COMMENT ON COLUMN public.lectures.curriculum_revision_id IS '교육과정 개정 ID (FK to curriculum_revisions)';
COMMENT ON COLUMN public.lectures.subject_id IS '과목 ID (FK to subjects)';
COMMENT ON COLUMN public.lectures.subject_group_id IS '교과 그룹 ID (FK to subject_groups)';
COMMENT ON COLUMN public.lectures.grade_level IS '대상 학년';
COMMENT ON COLUMN public.lectures.platform_id IS '플랫폼 ID (FK to platforms)';
COMMENT ON COLUMN public.lectures.lecture_source_url IS '출처 URL';
COMMENT ON COLUMN public.lectures.source IS '출처';
COMMENT ON COLUMN public.lectures.source_product_code IS '출처 상품 코드';
COMMENT ON COLUMN public.lectures.cover_image_url IS '표지 이미지 URL';
COMMENT ON COLUMN public.lectures.total_duration IS '총 강의 시간 (초)';
COMMENT ON COLUMN public.lectures.video_url IS '비디오 URL';
COMMENT ON COLUMN public.lectures.transcript IS '전사본';
COMMENT ON COLUMN public.lectures.episode_analysis IS '회차 분석 데이터';
COMMENT ON COLUMN public.lectures.overall_difficulty IS '전체 난이도';
COMMENT ON COLUMN public.lectures.target_exam_type IS '대상 시험 유형 배열';
COMMENT ON COLUMN public.lectures.tags IS '태그 배열';
COMMENT ON COLUMN public.lectures.is_active IS '활성화 여부';

