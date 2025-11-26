# Subjects Table - 실제 데이터베이스 스키마

**조회 일시**: 2025-11-23  
**데이터 소스**: 실제 Supabase 프로덕션 데이터베이스  
**총 레코드 수**: 52개

## 📋 실제 스키마 (데이터베이스에서 확인)

### 필드 목록

| #   | 필드명             | 타입          | NULL 허용 | 설명                                       | 비고      |
| --- | ------------------ | ------------- | --------- | ------------------------------------------ | --------- |
| 1   | `id`               | `uuid`        | NO        | 과목 고유 ID (PRIMARY KEY)                 |           |
| 2   | `subject_group_id` | `uuid`        | NO        | 교과 그룹 ID (FK → subject_groups)         |           |
| 3   | `name`             | `text`        | NO        | 과목명 (예: 국어, 문학, 독서)              |           |
| 4   | `display_order`    | `int4`        | NO        | 표시 순서                                  | Format: ✓ |
| 5   | `created_at`       | `timestamptz` | NO        | 생성일시                                   |           |
| 6   | `updated_at`       | `timestamptz` | NO        | 수정일시                                   |           |
| 7   | `subject_type_id`  | `uuid`        | YES       | 과목구분 ID (FK → subject_types, nullable) | Format: ✓ |

### 샘플 데이터

```json
{
  "id": "5c84525d-5723-4941-b425-6d0f30...",
  "subject_group_id": "ac8b1dd5-7491-4b20-bd44-84505b...",
  "name": "국어",
  "display_order": 1,
  "created_at": "2025-11-19T19:37:23.009803+00:00",
  "updated_at": "2025-11-19T19:37:23.009803+00:00",
  "subject_type_id": null // FK → subject_types
}
```

## 🔗 외래키 관계

### 확인된 관계

1. **subject_group_id** → `subject_groups(id)`

   - 관계 확인됨 ✅
   - 교과 그룹에 속함 (예: 국어, 수학, 영어)

2. **subject_type_id** → `subject_types(id)`
   - 관계 확인됨 ✅
   - 과목구분 (예: 공통, 일반선택, 진로선택)
   - NULL 허용 (과목구분이 없는 경우 가능)

## ⚠️ 중요 발견 사항

### 마이그레이션 파일과의 차이점

#### 실제 데이터베이스에 없는 필드 (마이그레이션에는 있음)

1. **`code`** (varchar(20))

   - 마이그레이션: 존재
   - 실제 DB: **없음** ❌

2. **`is_active`** (boolean)
   - 마이그레이션: 존재 (DEFAULT true)
   - 실제 DB: **없음** ❌

#### 실제 데이터베이스에 있는 필드 (마이그레이션에서는 제거 예정)

3. **`subject_type`** (text) ⚠️
   - 마이그레이션: `20250206000000_remove_subject_type_column.sql`에서 제거 예정
   - 실제 DB: **여전히 존재** ✅
   - **이유**: 마이그레이션이 아직 실행되지 않았거나, 제거 명령이 주석 처리되어 있음

### 가능한 이유

1. **`subject_type` 필드 상태**:

   - ✅ **실제로는 이미 제거됨** (마이그레이션 정상 실행됨)
   - ⚠️ Supabase UI에서 보였던 것은 **캐시 문제**였을 가능성
   - 실제 데이터베이스 쿼리 결과: `subject_type` 컬럼 없음
   - 삭제 시도 시 에러: `ERROR: column "subject_type" does not exist` → 컬럼이 실제로 존재하지 않음

2. **`code`, `is_active` 필드가 없는 이유**:
   - 마이그레이션이 아직 실행되지 않았을 수 있음
   - 초기 스키마 생성 시 해당 필드가 포함되지 않았을 수 있음

## 📊 테이블 통계

- **총 레코드 수**: 52개
- **샘플 데이터 확인**: ✅
- **관계 확인**: ✅

## 🔍 상세 스키마 조회 SQL

Supabase 대시보드에서 다음 쿼리를 실행하여 상세 정보를 확인할 수 있습니다:

```sql
-- subjects 테이블 스키마 상세 조회
SELECT
  column_name,
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subjects'
ORDER BY ordinal_position;
```

```sql
-- 제약조건 및 외래키 조회
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'subjects'
ORDER BY tc.constraint_type, tc.constraint_name;
```

```sql
-- 인덱스 조회
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'subjects';
```

## 📝 TypeScript 타입 정의 (실제 스키마 기반)

```typescript
export type Subject = {
  id: string; // uuid, NOT NULL
  subject_group_id: string; // uuid, NOT NULL, FK → subject_groups
  name: string; // text, NOT NULL
  display_order: number; // integer, NOT NULL
  created_at: string; // timestamptz, NOT NULL
  updated_at: string; // timestamptz, NOT NULL
  subject_type_id?: string | null; // uuid, nullable, FK → subject_types
};
```

## 🔄 마이그레이션 파일과의 비교

| 필드               | 마이그레이션 | 실제 DB | 상태          |
| ------------------ | ------------ | ------- | ------------- |
| `id`               | ✅           | ✅      | 일치          |
| `subject_group_id` | ✅           | ✅      | 일치          |
| `name`             | ✅           | ✅      | 일치          |
| `code`             | ✅           | ❌      | **차이**      |
| `subject_type`     | ❌ (제거됨)  | ❌      | **제거됨** ✅ |
| `subject_type_id`  | ✅           | ✅      | 일치          |
| `display_order`    | ✅           | ✅      | 일치          |
| `is_active`        | ✅           | ❌      | **차이**      |
| `created_at`       | ✅           | ✅      | 일치          |
| `updated_at`       | ✅           | ✅      | 일치          |

## 📖 관련 문서

- [Subjects Table Final Schema](./subjects-table-final-schema.md) - 마이그레이션 기반 스키마
- [Subjects Table Structure](./subjects-table-structure.md) - 상세 구조 설명
- [테이블 조회 가이드](./테이블-조회-가이드.md) - 쿼리 패턴 및 함수 사용법

## 🔧 마이그레이션 상태 확인

### `subject_type` 필드 제거 마이그레이션

**마이그레이션 파일**: `20250206000000_remove_subject_type_column.sql`

```sql
ALTER TABLE subjects DROP COLUMN IF EXISTS subject_type;
```

**현재 상태**:

- ✅ 마이그레이션은 **이미 실행된 것으로 기록**되어 있음
- ✅ 실제 데이터베이스에서도 `subject_type` 필드가 **정상적으로 제거됨**
- ⚠️ Supabase UI에서 보였던 것은 **캐시 문제**였을 가능성
- 삭제 시도 시 확인: `ERROR: column "subject_type" does not exist` → 컬럼이 실제로 존재하지 않음

**확인 방법**:

```sql
-- Supabase 대시보드에서 실행
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'subjects'
  AND column_name = 'subject_type';

-- 마이그레이션 히스토리 확인
SELECT * FROM supabase_migrations.schema_migrations
WHERE name LIKE '%remove_subject_type%'
ORDER BY version DESC;
```

**최종 확인 결과**:

1. ✅ **컬럼은 이미 제거됨**: 실제 데이터베이스 쿼리 결과 `subject_type` 컬럼 없음
2. ✅ **마이그레이션 정상 실행**: `20250206000000_remove_subject_type_column.sql` 성공적으로 실행됨
3. ⚠️ **UI 캐시 문제**: Supabase 대시보드에서 보였던 것은 캐시된 정보였을 가능성

**확인 방법**:

```sql
-- 실제 컬럼 목록 확인 (subject_type이 없어야 함)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'subjects'
ORDER BY ordinal_position;

-- 삭제 시도 시 에러 확인 (정상 동작)
-- ERROR: column "subject_type" does not exist
ALTER TABLE subjects DROP COLUMN subject_type;
```

**결론**:

- ✅ `subject_type` 컬럼은 이미 정상적으로 제거됨
- ✅ 현재는 `subject_type_id`만 사용 (FK → subject_types)
- ✅ 마이그레이션 상태 정상

---

**참고**: 이 문서는 실제 데이터베이스에서 조회한 정보를 기반으로 작성되었습니다.  
마이그레이션 파일과 차이가 있는 경우, 실제 데이터베이스 스키마가 정확한 기준입니다.
