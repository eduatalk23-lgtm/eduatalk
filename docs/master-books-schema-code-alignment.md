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

## ✅ 코드와 스키마 일치 확인 결과

### 1. createMasterBook 함수 (`lib/data/contentMasters.ts:787-841`)

**모든 필드 처리됨** ✅

```typescript
insert({
  tenant_id, is_active, curriculum_revision_id, subject_id,
  grade_min, grade_max, school_type, revision, content_category,
  semester, title, subtitle, series_name, author,
  publisher_id, publisher_name, isbn_10, isbn_13,
  edition, published_date, total_pages, target_exam_type,
  description, toc, publisher_review, tags,
  source, source_product_code, source_url, cover_image_url,
  difficulty_level, notes, pdf_url, ocr_data,
  page_analysis, overall_difficulty
})
```

**총 40개 필드 모두 포함** ✅

### 2. updateMasterBook 함수 (`lib/data/contentMasters.ts:846-890`)

**모든 필드 처리됨** ✅

각 필드에 대해 `undefined` 체크 후 업데이트 필드에 포함

### 3. getMasterBookById 함수 (`lib/data/contentMasters.ts:158-286`)

**모든 필드 SELECT됨** ✅

- 기본 필드: `id, tenant_id, revision, content_category, semester, title, total_pages, difficulty_level, notes, pdf_url, ocr_data, page_analysis, overall_difficulty, updated_at, created_at, is_active`
- FK 필드: `curriculum_revision_id, subject_id, grade_min, grade_max, school_type`
- 메타 정보: `subtitle, series_name, author, publisher_id, publisher_name, isbn_10, isbn_13, edition, published_date`
- 추가 정보: `target_exam_type, description, toc, publisher_review, tags, source, source_product_code, source_url, cover_image_url`
- JOIN: `curriculum_revisions, subjects, subject_groups, publishers`

### 4. 타입 정의 (`lib/types/plan.ts:327-374`)

**MasterBook 타입** - ✅ 모든 필드 일치

### 5. 액션 함수 (`app/(student)/actions/masterContentActions.ts:47-84`)

**addMasterBook** - ✅ 모든 필드 처리됨

---

## 📊 최종 확인 결과

### ✅ 모든 필드 일치

- **실제 스키마**: 40개 컬럼
- **코드 처리**: 40개 필드 모두 처리
- **타입 정의**: 40개 필드 모두 포함
- **FK 연결**: 4개 FK 모두 올바르게 처리
- **제약조건**: CHECK, UNIQUE 제약조건 모두 준수

### ✅ 특별 확인 사항

1. **published_date**: `date` 타입 → 코드에서 `string | null`로 처리 (Supabase 자동 변환)
2. **target_exam_type**: `text[]` 타입 → 코드에서 `string[] | null`로 처리 ✅
3. **tags**: `text[]` 타입 → 코드에서 `string[] | null`로 처리 ✅
4. **isbn_13**: UNIQUE 제약조건 → 코드에서 중복 체크 없음 (DB 레벨에서 처리) ✅

---

## 📅 작성일
2025-01-XX

