# master_books 테이블 스키마와 코드 정렬 확인

## 📋 실제 데이터베이스 스키마

### 컬럼 목록 (총 40개)

| 컬럼명 | 타입 | NULL 허용 | 기본값 | 제약조건 |
|--------|------|-----------|--------|----------|
| `id` | uuid | NO | gen_random_uuid() | PRIMARY KEY |
| `tenant_id` | uuid | YES | - | FK → tenants.id |
| `revision` | varchar | YES | - | - |
| `content_category` | varchar | YES | - | - |
| `semester` | varchar | YES | - | - |
| `title` | text | NO | - | - |
| `total_pages` | integer | YES | - | CHECK > 0 |
| `difficulty_level` | varchar | YES | - | - |
| `notes` | text | YES | - | - |
| `pdf_url` | text | YES | - | - |
| `ocr_data` | jsonb | YES | - | - |
| `page_analysis` | jsonb | YES | - | - |
| `overall_difficulty` | numeric | YES | - | - |
| `updated_at` | timestamptz | YES | now() | - |
| `created_at` | timestamptz | YES | now() | - |
| `is_active` | boolean | NO | true | - |
| `curriculum_revision_id` | uuid | YES | - | FK → curriculum_revisions.id |
| `subject_id` | uuid | YES | - | FK → subjects.id |
| `grade_min` | integer | YES | - | CHECK 1-3 |
| `grade_max` | integer | YES | - | CHECK 1-3 |
| `school_type` | text | YES | - | CHECK MIDDLE/HIGH/OTHER |
| `subtitle` | text | YES | - | - |
| `series_name` | text | YES | - | - |
| `author` | text | YES | - | - |
| `publisher_id` | uuid | YES | - | FK → publishers.id |
| `publisher_name` | text | YES | - | - |
| `isbn_10` | text | YES | - | - |
| `isbn_13` | text | YES | - | UNIQUE |
| `edition` | text | YES | - | - |
| `published_date` | date | YES | - | - |
| `target_exam_type` | text[] | YES | - | - |
| `description` | text | YES | - | - |
| `toc` | text | YES | - | - |
| `publisher_review` | text | YES | - | - |
| `tags` | text[] | YES | - | - |
| `source` | text | YES | - | - |
| `source_product_code` | text | YES | - | - |
| `source_url` | text | YES | - | - |
| `cover_image_url` | text | YES | - | - |

### FK 제약조건

1. `tenant_id` → `tenants.id`
2. `curriculum_revision_id` → `curriculum_revisions.id`
3. `subject_id` → `subjects.id`
4. `publisher_id` → `publishers.id`

### UNIQUE 제약조건

- `isbn_13` (UNIQUE)

### CHECK 제약조건

- `total_pages > 0`
- `grade_min` IS NULL OR `grade_min` BETWEEN 1 AND 3
- `grade_max` IS NULL OR `grade_max` BETWEEN 1 AND 3
- `school_type` IS NULL OR `school_type` IN ('MIDDLE', 'HIGH', 'OTHER')

---

## ✅ 코드와 스키마 일치 확인

### 1. 타입 정의 (`lib/types/plan.ts`)

**MasterBook 타입** - ✅ 모든 필드 일치

### 2. 액션 함수 (`app/(student)/actions/masterContentActions.ts`)

**addMasterBook** - ✅ 모든 필드 처리됨

### 3. 데이터 레이어 (`lib/data/contentMasters.ts`)

**getMasterBookById** - ✅ 모든 필드 SELECT됨

**createMasterBook** - 확인 필요

---

## 🔍 확인 사항

### createMasterBook 함수 확인

`lib/data/contentMasters.ts`의 `createMasterBook` 함수가 실제 스키마의 모든 필드를 올바르게 처리하는지 확인해야 합니다.

---

## 📅 작성일
2025-01-XX

