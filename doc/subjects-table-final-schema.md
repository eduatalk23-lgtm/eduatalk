# Subjects Table - 최신 스키마 (Final Schema)

## 📋 최종 스키마 정의

마이그레이션 파일 분석을 통해 확인한 **최신 subjects 테이블 구조**입니다.

```sql
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_group_id uuid NOT NULL REFERENCES subject_groups(id) ON DELETE RESTRICT,
  name varchar(50) NOT NULL,
  code varchar(20),                                    -- 선택사항
  subject_type_id uuid REFERENCES subject_types(id) ON DELETE SET NULL,  -- nullable
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT subjects_subject_group_id_name_key UNIQUE (subject_group_id, name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_subjects_subject_type_id ON subjects(subject_type_id);

-- 코멘트
COMMENT ON TABLE subjects IS '과목 테이블 (전역 관리, 교과 그룹별)';
COMMENT ON COLUMN subjects.subject_type_id IS '과목구분 ID (FK → subject_types, nullable)';
```

## 📊 필드 상세 정보

| 필드명 | 타입 | 제약조건 | 기본값 | 설명 |
|--------|------|----------|--------|------|
| `id` | `uuid` | PRIMARY KEY | `gen_random_uuid()` | 과목 고유 ID |
| `subject_group_id` | `uuid` | NOT NULL, FK → `subject_groups(id)` | - | 교과 그룹 ID (예: 국어, 수학, 영어) |
| `name` | `varchar(50)` | NOT NULL | - | 과목명 (예: 화법과 작문, 미적분, 영어독해와 작문) |
| `code` | `varchar(20)` | NULL | - | 과목 코드 (선택사항, 현재 사용 여부 확인 필요) |
| `subject_type_id` | `uuid` | NULL, FK → `subject_types(id)` | - | 과목구분 ID (공통, 일반선택, 진로선택) |
| `display_order` | `integer` | NOT NULL | `0` | 표시 순서 |
| `is_active` | `boolean` | NOT NULL | `true` | 활성화 여부 |
| `created_at` | `timestamptz` | - | `now()` | 생성일시 |
| `updated_at` | `timestamptz` | - | `now()` | 수정일시 |

## 🔗 관계 (Relationships)

### Foreign Keys

1. **subject_group_id** → `subject_groups(id)`
   - **ON DELETE**: RESTRICT (교과 그룹 삭제 시 제한)
   - **설명**: 과목이 속한 교과 그룹 (예: 국어, 수학, 영어)

2. **subject_type_id** → `subject_types(id)`
   - **ON DELETE**: SET NULL (과목구분 삭제 시 NULL로 설정)
   - **설명**: 과목구분 (예: 공통, 일반선택, 진로선택)
   - **NULL 허용**: 과목구분이 없는 경우 가능

### Unique Constraints

- `(subject_group_id, name)` - 교과 그룹 내에서 과목명은 고유해야 함
  - 인덱스명: `subjects_subject_group_id_name_key`

### Indexes

- `idx_subjects_subject_type_id` - `subject_type_id` 컬럼 인덱스

## 📝 마이그레이션 히스토리

### 변경 이력

| 날짜 | 마이그레이션 파일 | 변경 내용 |
|------|------------------|-----------|
| 2025-02-04 | `20250204000000_make_subject_groups_global.sql` | UNIQUE 제약조건 변경: `(tenant_id, subject_group_id, name)` → `(subject_group_id, name)` |
| 2025-02-04 | `20250204000001_migrate_subject_data_to_global.sql` | `tenant_id` 컬럼 제거 (전역 관리로 변경) |
| 2025-02-04 | `20250204000002_deprecate_subject_categories.sql` | `subject_category_id` 컬럼 제거 (`subject_categories` 테이블 deprecated) |
| 2025-02-05 | `20250205000001_add_curriculum_year_and_subject_types.sql` | `subject_type_id` 컬럼 추가 (FK → `subject_types`) |
| 2025-02-06 | `20250206000000_remove_subject_type_column.sql` | `subject_type` (text) 컬럼 제거 (`subject_type_id`만 사용) |

### 제거된 필드

1. **tenant_id** (uuid)
   - 제거일: 2025-02-04
   - 이유: 전역 관리로 변경 (모든 테넌트 공통 사용)

2. **subject_category_id** (uuid)
   - 제거일: 2025-02-04
   - 이유: `subject_categories` 테이블 deprecated, `subject_groups`로 대체

3. **subject_type** (text)
   - 제거일: 2025-02-06
   - 이유: `subject_type_id` (uuid FK)로 대체

## 🔍 TypeScript 타입 정의

```typescript
// lib/data/subjects.ts
export type Subject = {
  id: string;
  subject_group_id: string;           // FK to subject_groups (NOT NULL)
  name: string;                        // 과목명 (NOT NULL)
  display_order: number;
  subject_type_id?: string | null;     // FK to subject_types (nullable)
  subject_type?: string | null;        // 과목구분명 (JOIN 결과, 하위 호환성)
  created_at?: string;
  updated_at?: string;
};
```

**참고**: `subject_type` 필드는 실제 DB에는 없지만, JOIN 결과를 위해 TypeScript 타입에 포함되어 있습니다.

## 📚 관련 테이블

### Parent Table
- **subject_groups** (교과 그룹)
  - `id` → `subjects.subject_group_id`
  - 예: 국어, 수학, 영어, 과학, 사회
  - 전역 관리 (tenant_id 없음)
  - 개정교육과정별 관리 (`curriculum_revision_id`)

### Related Table
- **subject_types** (과목구분)
  - `id` → `subjects.subject_type_id`
  - 예: 공통, 일반선택, 진로선택
  - 개정교육과정별 관리 (`curriculum_revision_id`)

### 계층 구조 (Hierarchy)

```
curriculum_revisions (개정교육과정)
  ├─ subject_groups (교과 그룹)
  │   └─ subjects (과목)
  │       └─ subject_types (과목구분) [via subject_type_id]
  └─ subject_types (과목구분)
```

## 🔍 쿼리 예시

### 기본 조회

```typescript
// 특정 교과 그룹의 과목 목록 조회
const { data } = await supabase
  .from("subjects")
  .select("*")
  .eq("subject_group_id", subjectGroupId)
  .order("display_order", { ascending: true });
```

### 과목구분 포함 조회

```typescript
// 과목구분 정보 포함 조회
const { data } = await supabase
  .from("subjects")
  .select(`
    *,
    subject_types:subject_type_id (
      id,
      name,
      display_order,
      is_active
    )
  `)
  .eq("subject_group_id", subjectGroupId)
  .order("display_order", { ascending: true });
```

### 전체 계층 구조 조회

```typescript
// 교과 그룹 + 과목 + 과목구분 전체 조회
const { data } = await supabase
  .from("subject_groups")
  .select(`
    *,
    subjects:subjects (
      *,
      subject_types:subject_type_id (
        id,
        name,
        display_order
      )
    )
  `)
  .eq("curriculum_revision_id", curriculumRevisionId)
  .order("display_order", { ascending: true });
```

### 함수 사용 (권장)

```typescript
import { getSubjectsByGroup, getSubjectHierarchyOptimized } from "@/lib/data/subjects";

// 특정 교과 그룹의 과목 목록 (과목구분 포함)
const subjects = await getSubjectsByGroup(subjectGroupId);

// 전체 계층 구조 조회 (최적화 버전)
const hierarchy = await getSubjectHierarchyOptimized(curriculumRevisionId);
```

## ⚠️ 중요 사항

1. **전역 관리**: `tenant_id`가 없으므로 모든 테넌트에서 공통으로 사용
2. **과목구분은 선택사항**: `subject_type_id`는 NULL 허용
3. **하위 호환성**: TypeScript 타입에 `subject_type` (string) 필드가 있지만, 실제 DB에는 `subject_type_id`만 존재
4. **UNIQUE 제약**: 교과 그룹 내에서 과목명은 고유해야 함
5. **code 필드**: `code` 필드는 존재하지만 현재 사용 여부 확인 필요

## 📖 관련 문서

- [Subjects Table Structure](./subjects-table-structure.md) - 상세 구조 설명
- [테이블 조회 가이드](./테이블-조회-가이드.md) - 쿼리 패턴 및 함수 사용법
- [과목구분 위계 구조 분석](./과목구분-위계-구조-분석.md) - 계층 구조 상세 설명
- [교육과정 교과 과목 테이블 연결 확인](./교육과정-교과-과목-테이블-연결-확인.md) - 테이블 간 관계

---

**최종 업데이트**: 2025-02-06 (마이그레이션 `20250206000000_remove_subject_type_column.sql` 이후)

