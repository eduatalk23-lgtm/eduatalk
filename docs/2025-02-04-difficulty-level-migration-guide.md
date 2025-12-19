# difficulty_level → difficulty_level_id 마이그레이션 가이드

## 📋 개요

이 문서는 `difficulty_level` 텍스트 필드를 `difficulty_level_id` UUID Foreign Key로 마이그레이션하는 방법을 안내합니다.

## 🎯 목표

- 데이터 정규화: `difficulty_levels` 테이블을 통한 일관성 있는 난이도 관리
- 타입 안전성: Foreign Key 제약조건으로 데이터 무결성 보장
- 성능 향상: 인덱스를 통한 조회 성능 개선

---

## 📊 데이터베이스 스키마

### difficulty_levels 테이블

```sql
CREATE TABLE difficulty_levels (
  id uuid PRIMARY KEY,
  name varchar(50) NOT NULL,
  content_type varchar(20) NOT NULL, -- 'book', 'lecture', 'custom'
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, content_type)
);
```

### 마이그레이션된 테이블

다음 테이블들은 `difficulty_level_id` 컬럼을 포함합니다:

- `master_books` (difficulty_level_id)
- `master_lectures` (difficulty_level_id)
- `master_custom_contents` (difficulty_level_id)
- `books` (difficulty_level_id)
- `lectures` (difficulty_level_id)
- `student_custom_contents` (difficulty_level_id)

**참고**: `difficulty_level` 컬럼은 하위 호환성을 위해 유지되며, deprecated로 표시됩니다.

---

## 🔄 마이그레이션 전략

### 1. 우선순위

1. **difficulty_level_id 우선 사용**: 새로운 코드에서는 항상 `difficulty_level_id`를 사용합니다.
2. **하위 호환성 유지**: 기존 `difficulty_level` 문자열도 계속 지원합니다.
3. **자동 변환**: `difficulty_level` 문자열이 제공되면 자동으로 `difficulty_level_id`로 변환합니다.

### 2. 변환 로직

#### difficulty_level → difficulty_level_id 변환

```typescript
import { convertDifficultyLevelToId } from "@/lib/utils/difficultyLevelConverter";

// 단일 변환
const difficultyLevelId = await convertDifficultyLevelToId(
  supabase,
  "개념", // difficulty_level 문자열
  "book"  // contentType
);
```

#### difficulty_level_id → difficulty_level 변환

```typescript
// difficulty_levels 테이블에서 name 조회
const { data } = await supabase
  .from("difficulty_levels")
  .select("name")
  .eq("id", difficultyLevelId)
  .single();

const difficultyLevel = data?.name ?? null;
```

---

## 📝 코드 마이그레이션 가이드

### 타입 정의

#### Before

```typescript
type Book = {
  difficulty_level?: string | null;
};
```

#### After

```typescript
type Book = {
  /** @deprecated difficulty_level_id를 사용하세요. */
  difficulty_level?: string | null;
  difficulty_level_id?: string | null;
};
```

### 폼 컴포넌트

#### Before

```tsx
<FormSelect
  name="difficulty"
  options={[
    { value: "하", label: "하" },
    { value: "중", label: "중" },
    { value: "상", label: "상" },
  ]}
/>
```

#### After

```tsx
import { DifficultySelectField } from "@/components/forms/DifficultySelectField";

<DifficultySelectField
  contentType="book"
  name="difficulty_level_id"
  defaultValue={book.difficulty_level_id}
/>
```

### 데이터 생성/업데이트

#### Before

```typescript
await createBook({
  difficulty_level: "개념",
});
```

#### After

```typescript
// 방법 1: difficulty_level_id 직접 사용 (권장)
await createBook({
  difficulty_level_id: "uuid-here",
});

// 방법 2: difficulty_level 문자열 사용 (자동 변환)
await createBook({
  difficulty_level: "개념", // 자동으로 difficulty_level_id로 변환됨
});
```

### 데이터 조회

#### Before

```typescript
const { data } = await supabase
  .from("books")
  .select("id, title, difficulty_level");
```

#### After

```typescript
// difficulty_level_id 포함
const { data } = await supabase
  .from("books")
  .select("id, title, difficulty_level, difficulty_level_id");

// 또는 difficulty_levels JOIN
const { data } = await supabase
  .from("books")
  .select(`
    id,
    title,
    difficulty_level,
    difficulty_level_id,
    difficulty_levels:difficulty_level_id (
      id,
      name
    )
  `);
```

---

## 🛠 유틸리티 함수

### convertDifficultyLevelToId

```typescript
import { convertDifficultyLevelToId } from "@/lib/utils/difficultyLevelConverter";

// 단일 변환
const id = await convertDifficultyLevelToId(
  supabase,
  "개념",
  "book"
);

// null 처리
const id = await convertDifficultyLevelToId(
  supabase,
  null,
  "book"
); // null 반환
```

### convertDifficultyLevelsToIds

```typescript
import { convertDifficultyLevelsToIds } from "@/lib/utils/difficultyLevelConverter";

// 배치 변환
const map = await convertDifficultyLevelsToIds(supabase, [
  { level: "개념", contentType: "book" },
  { level: "기본", contentType: "book" },
]);

// 사용
const conceptId = map.get("개념");
```

### enrichDifficultyLevels

```typescript
import { enrichDifficultyLevels } from "@/lib/data/contentMasters";

// difficulty_level_id → difficulty_level 변환
const enriched = await enrichDifficultyLevels(supabase, items);
// items의 difficulty_level_id가 difficulty_level로 변환됨
```

---

## 📦 컴포넌트

### DifficultySelectField

```tsx
import { DifficultySelectField } from "@/components/forms/DifficultySelectField";

<DifficultySelectField
  contentType="book" // 또는 "lecture", "custom"
  name="difficulty_level_id"
  defaultValue={book.difficulty_level_id}
  label="난이도"
  required={false}
/>
```

**특징**:
- `difficulty_levels` 테이블에서 동적으로 옵션 로드
- `contentType`에 따라 적절한 난이도 옵션 표시
- `difficulty_level_id` 값 사용

---

## 🔍 API 응답

### 마스터 콘텐츠 API

```json
{
  "success": true,
  "data": {
    "metadata": {
      "difficulty_level": "개념",
      "difficulty_level_id": "uuid-here"
    }
  }
}
```

### 학생 콘텐츠 API

```json
{
  "success": true,
  "data": {
    "metadata": {
      "difficulty_level": "개념",
      "difficulty_level_id": "uuid-here"
    }
  }
}
```

---

## ✅ 체크리스트

### 새로운 코드 작성 시

- [ ] `difficulty_level_id` 우선 사용
- [ ] `DifficultySelectField` 컴포넌트 사용
- [ ] 타입 정의에 `difficulty_level_id` 포함
- [ ] API 응답에 `difficulty_level_id` 포함

### 기존 코드 마이그레이션 시

- [ ] `difficulty_level` 사용처 확인
- [ ] `difficulty_level_id` 추가
- [ ] 자동 변환 로직 적용 (필요시)
- [ ] 하위 호환성 유지
- [ ] 테스트 확인

---

## 🚨 주의사항

1. **하위 호환성**: `difficulty_level` 컬럼은 유지되며, 자동 변환 로직으로 마이그레이션 부담 감소
2. **데이터 일관성**: `difficulty_level_id`와 `difficulty_level`이 불일치할 수 있으므로, `difficulty_level_id`를 우선 사용
3. **성능**: `difficulty_level_id`는 인덱스가 있어 조회 성능이 향상됨
4. **타입 안전성**: Foreign Key 제약조건으로 데이터 무결성 보장

---

## 📚 참고 자료

- [Phase 3 마이그레이션 문서](./2025-02-04-phase3-difficulty-level-migration.md)
- [difficulty_levels 테이블 스키마](../supabase/migrations/20251216222517_create_difficulty_levels.sql)
- [마이그레이션 파일](../supabase/migrations/20251219181731_add_difficulty_level_id_to_student_tables.sql)

---

**작성일**: 2025-02-04  
**작성자**: AI Assistant

