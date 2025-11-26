# Subjects Table Structure

## 📋 Current Schema (as of latest migrations)

### Base Table Structure

```sql
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_group_id uuid NOT NULL REFERENCES subject_groups(id) ON DELETE RESTRICT,
  name varchar(50) NOT NULL,
  code varchar(20),                    -- Optional: 과목 코드
  subject_type_id uuid REFERENCES subject_types(id) ON DELETE SET NULL,  -- FK to subject_types
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subject_group_id, name)       -- 교과 그룹 내에서 과목명 중복 방지
);
```

## 📊 Field Details

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 과목 고유 ID |
| `subject_group_id` | `uuid` | NOT NULL, FK → subject_groups(id) | 교과 그룹 ID (예: 국어, 수학, 영어) |
| `name` | `varchar(50)` | NOT NULL | 과목명 (예: 화법과 작문, 미적분, 영어독해와 작문) |
| `code` | `varchar(20)` | NULL | 과목 코드 (선택사항) |
| `subject_type_id` | `uuid` | NULL, FK → subject_types(id) | 과목구분 ID (공통, 일반선택, 진로선택) |
| `display_order` | `integer` | NOT NULL, DEFAULT 0 | 표시 순서 |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | 활성화 여부 |
| `created_at` | `timestamptz` | DEFAULT now() | 생성일시 |
| `updated_at` | `timestamptz` | DEFAULT now() | 수정일시 |

## 🔗 Relationships

### Foreign Keys

1. **subject_group_id** → `subject_groups(id)`
   - 교과 그룹에 속함 (예: 국어, 수학, 영어)
   - ON DELETE RESTRICT (교과 그룹 삭제 시 제한)

2. **subject_type_id** → `subject_types(id)`
   - 과목구분에 속함 (예: 공통, 일반선택, 진로선택)
   - ON DELETE SET NULL (과목구분 삭제 시 NULL로 설정)
   - NULL 허용 (과목구분이 없는 경우 가능)

### Unique Constraints

- `(subject_group_id, name)` - 교과 그룹 내에서 과목명은 고유해야 함

## 📝 Migration History

### Key Changes

1. **2025-02-04**: `tenant_id` 제거 → 전역 관리로 변경
   - `subject_group_id`로 교과 그룹 참조
   - UNIQUE 제약조건: `(subject_group_id, name)`

2. **2025-02-04**: `subject_category_id` 제거
   - `subject_categories` 테이블 deprecated
   - `subject_groups`로 대체

3. **2025-02-05**: `subject_type_id` 추가
   - 기존 `subject_type` (text) → `subject_type_id` (uuid FK)
   - `subject_types` 테이블과 연결

4. **2025-02-06**: `subject_type` 컬럼 제거
   - `subject_type_id`만 사용
   - 하위 호환성을 위해 TypeScript 타입에는 `subject_type` (string) 포함

## 🔍 TypeScript Type Definition

```typescript
export type Subject = {
  id: string;
  subject_group_id: string;           // FK to subject_groups
  name: string;                        // 과목명
  display_order: number;
  subject_type_id?: string | null;     // FK to subject_types (nullable)
  subject_type?: string | null;        // 과목구분명 (JOIN 결과, 하위 호환성)
  created_at?: string;
  updated_at?: string;
};
```

## 📚 Related Tables

### Parent Table
- **subject_groups** (교과 그룹)
  - `id` → `subjects.subject_group_id`
  - 예: 국어, 수학, 영어, 과학, 사회

### Related Table
- **subject_types** (과목구분)
  - `id` → `subjects.subject_type_id`
  - 예: 공통, 일반선택, 진로선택

### Hierarchy Structure

```
curriculum_revisions (개정교육과정)
  └─ subject_groups (교과 그룹)
      └─ subjects (과목)
          └─ subject_types (과목구분) [via subject_type_id]
```

## 🔍 Query Examples

### Basic Query

```typescript
// 특정 교과 그룹의 과목 목록 조회
const { data } = await supabase
  .from("subjects")
  .select("*")
  .eq("subject_group_id", subjectGroupId)
  .order("display_order", { ascending: true });
```

### With JOIN (과목구분 포함)

```typescript
// 과목구분 정보 포함 조회
const { data } = await supabase
  .from("subjects")
  .select(`
    *,
    subject_types:subject_type_id (
      id,
      name,
      display_order
    )
  `)
  .eq("subject_group_id", subjectGroupId);
```

### Full Hierarchy Query

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
        name
      )
    )
  `)
  .eq("curriculum_revision_id", curriculumRevisionId);
```

## ⚠️ Important Notes

1. **전역 관리**: `tenant_id`가 없으므로 모든 테넌트에서 공통으로 사용
2. **과목구분은 선택사항**: `subject_type_id`는 NULL 허용
3. **하위 호환성**: TypeScript 타입에 `subject_type` (string) 필드가 있지만, 실제 DB에는 `subject_type_id`만 존재
4. **UNIQUE 제약**: 교과 그룹 내에서 과목명은 고유해야 함

## 📖 Related Documentation

- [테이블 조회 가이드](./테이블-조회-가이드.md)
- [과목구분 위계 구조 분석](./과목구분-위계-구조-분석.md)
- [교육과정 교과 과목 테이블 연결 확인](./교육과정-교과-과목-테이블-연결-확인.md)

