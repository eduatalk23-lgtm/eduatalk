# master_books 테이블 스키마 재정리

**작업일**: 2025-11-30  
**마이그레이션 파일**: `supabase/migrations/20251130005859_restructure_master_books_schema.sql`

## 작업 개요

교재 관련 테이블(`master_books`, `book_details`, `content_master_details`)의 스키마를 새로운 요구사항에 맞춰 전면 재정리했습니다. 모든 기존 데이터는 삭제되었으며, 컬럼 추가/제거 및 제약조건이 재설정되었습니다.

## 변경 내역

### 1. master_books 테이블

#### 삭제된 컬럼 (3개)
- `subject_category` (varchar) - 더 이상 사용하지 않음
- `subject` (varchar) - subject_id FK로 대체
- `publisher` (varchar) - publisher_id FK로 대체

#### 추가된 컬럼 (22개)

**기본 정보**
- `is_active` (boolean, NOT NULL, DEFAULT true) - 교재 활성화 상태

**교육과정 관련**
- `curriculum_revision_id` (uuid, FK → curriculum_revisions) - 교육과정 개정판
- `subject_id` (uuid, FK → subjects) - 과목 ID
- `grade_min` (integer, CHECK: 1-3) - 최소 학년
- `grade_max` (integer, CHECK: 1-3) - 최대 학년
- `school_type` (text, CHECK: MIDDLE/HIGH/OTHER) - 학교 유형

**교재 메타 정보**
- `subtitle` (text) - 부제목
- `series_name` (text) - 시리즈명
- `author` (text) - 저자
- `publisher_id` (uuid, FK → publishers) - 출판사 ID
- `publisher_name` (text) - 출판사명 (중복 저장)

**ISBN 정보**
- `isbn_10` (text) - ISBN-10 코드
- `isbn_13` (text, UNIQUE) - ISBN-13 코드 (고유 제약)

**출판 정보**
- `edition` (text) - 판차
- `published_date` (date) - 출판일

**추가 교육 메타 정보**
- `target_exam_type` (text[]) - 대상 시험 유형 (배열)

**설명 및 리뷰**
- `description` (text) - 교재 설명
- `toc` (text) - 목차 (Table of Contents)
- `publisher_review` (text) - 출판사 리뷰
- `tags` (text[]) - 태그 (배열)

**출처 정보**
- `source` (text) - 데이터 출처
- `source_product_code` (text) - 출처 상품 코드
- `source_url` (text) - 출처 URL
- `cover_image_url` (text) - 표지 이미지 URL

#### 변경된 컬럼
- `title`: `varchar` → `text` (타입 변경)
- `total_pages`: `NOT NULL` 제약 제거 (선택적으로 변경)

#### 추가된 제약조건
- **FK 제약** (3개):
  - `curriculum_revision_id` → `curriculum_revisions(id)`
  - `subject_id` → `subjects(id)`
  - `publisher_id` → `publishers(id)`

- **CHECK 제약** (3개):
  - `grade_min`: NULL 또는 1-3 사이
  - `grade_max`: NULL 또는 1-3 사이
  - `school_type`: NULL 또는 'MIDDLE', 'HIGH', 'OTHER' 중 하나

- **UNIQUE 제약** (1개):
  - `isbn_13`: 중복 불가

### 2. book_details 테이블

#### 변경된 제약조건
- **기존**: `UNIQUE (book_id, page_number)` → `book_details_book_page_unique`
- **변경**: `UNIQUE (book_id, display_order)` → `book_details_book_id_display_order_key`

**변경 이유**: 목차의 정렬 순서는 `display_order`로 관리하며, 동일한 교재 내에서 중복된 display_order가 없어야 함

### 3. content_master_details 테이블

#### 변경된 제약조건
- **기존**: `UNIQUE (master_id, page_number)` → `content_master_details_master_page_unique`
- **변경**: `UNIQUE (master_id, display_order)` → `content_master_details_master_id_display_order_key`

**변경 이유**: `book_details`와 동일한 논리로, 콘텐츠의 정렬 순서는 `display_order`로 관리

## 데이터 정리

다음 테이블의 모든 데이터가 `TRUNCATE CASCADE`로 삭제되었습니다:
- `book_details` (목차 정보)
- `books` (학생 교재 정보)
- `master_lectures` (강의 정보)
- `master_books` (교재 마스터 정보)

## 애플리케이션 코드 영향

### 수정 필요 사항

다음 컬럼들이 삭제되었으므로, 애플리케이션 코드에서 참조하는 부분을 수정해야 합니다:

1. **`master_books.subject_category`** 제거
   - 대체: `subject_id`를 통한 `subjects` 테이블 JOIN

2. **`master_books.subject`** 제거
   - 대체: `subject_id`를 통한 `subjects` 테이블 JOIN

3. **`master_books.publisher`** 제거
   - 대체: `publisher_id`를 통한 `publishers` 테이블 JOIN
   - 또는: `publisher_name` 직접 사용 (중복 저장)

### 검색 대상 파일

다음 패턴으로 코드를 검색하여 수정이 필요한 부분을 찾으세요:

```bash
# subject_category 참조 검색
grep -r "subject_category" app/ lib/ components/

# subject 참조 검색 (단, subject_id는 제외)
grep -r "\.subject[^_]" app/ lib/ components/

# publisher 참조 검색 (단, publisher_id, publisher_name은 제외)
grep -r "\.publisher[^_]" app/ lib/ components/
```

## 최종 스키마

### master_books

```sql
CREATE TABLE public.master_books (
  -- 기본 키
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 테넌트 및 활성화
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  
  -- 교육과정 관련
  curriculum_revision_id uuid REFERENCES public.curriculum_revisions(id),
  subject_id uuid REFERENCES public.subjects(id),
  grade_min integer CHECK (grade_min IS NULL OR (grade_min BETWEEN 1 AND 3)),
  grade_max integer CHECK (grade_max IS NULL OR (grade_max BETWEEN 1 AND 3)),
  school_type text CHECK (school_type IS NULL OR school_type IN ('MIDDLE','HIGH','OTHER')),
  
  -- 교재 기본 정보
  title text NOT NULL,
  subtitle text,
  series_name text,
  author text,
  publisher_id uuid REFERENCES public.publishers(id),
  publisher_name text,
  
  -- ISBN
  isbn_10 text,
  isbn_13 text UNIQUE,
  
  -- 출판 정보
  edition text,
  published_date date,
  total_pages integer CHECK (total_pages > 0),
  
  -- 교육 메타 정보
  revision text,
  content_category text,
  semester text,
  difficulty_level text,
  overall_difficulty numeric,
  target_exam_type text[],
  
  -- 설명 및 리뷰
  description text,
  toc text,
  publisher_review text,
  tags text[],
  
  -- 출처 정보
  source text,
  source_product_code text,
  source_url text,
  cover_image_url text,
  
  -- PDF 및 분석 데이터
  pdf_url text,
  ocr_data jsonb,
  page_analysis jsonb,
  
  -- 메모
  notes text,
  
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### book_details

```sql
CREATE TABLE public.book_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.master_books(id) ON DELETE CASCADE,
  major_unit varchar,
  minor_unit varchar,
  page_number integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT book_details_book_id_display_order_key UNIQUE (book_id, display_order)
);
```

### content_master_details

```sql
CREATE TABLE public.content_master_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES public.content_masters(id) ON DELETE CASCADE,
  major_unit varchar,
  minor_unit varchar,
  page_number integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT content_master_details_master_id_display_order_key UNIQUE (master_id, display_order)
);
```

## 검증 결과

마이그레이션 후 스키마 검증 완료:
- ✅ 모든 컬럼 추가/제거 완료
- ✅ 모든 FK 제약 정상 생성
- ✅ 모든 CHECK 제약 정상 생성
- ✅ 모든 UNIQUE 제약 정상 생성
- ✅ 컬럼 타입 변경 완료

## 주의사항

1. **데이터 손실**: 이 마이그레이션으로 모든 교재 관련 데이터가 삭제되었습니다.
2. **운영 환경 주의**: 운영 환경에서는 절대 실행하지 마세요. 개발/테스트 환경 전용입니다.
3. **애플리케이션 코드 수정 필수**: 삭제된 컬럼을 참조하는 코드를 반드시 수정해야 합니다.
4. **의존 테이블 필요**: `curriculum_revisions`, `subjects`, `publishers` 테이블이 미리 존재해야 합니다.

## 후속 작업

- [ ] 애플리케이션 코드에서 삭제된 컬럼 참조 제거
- [ ] 새로운 컬럼을 활용하는 기능 개발
- [ ] 교재 데이터 재입력 또는 마이그레이션 스크립트 작성
- [ ] API 엔드포인트 업데이트
- [ ] TypeScript 타입 정의 업데이트

