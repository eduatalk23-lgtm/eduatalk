# display_order 필드 제거 작업

## 📋 작업 개요

데이터베이스에서 `display_order` 필드를 제거한 후, 코드베이스에서 해당 필드 참조를 모두 제거했습니다.

## 🗑 제거된 테이블

다음 테이블에서 `display_order` 필드가 제거되었습니다:
- `curriculum_revisions` (개정교육과정)
- `subject_groups` (교과)
- `subjects` (과목)
- `subject_types` (과목구분)

## 📝 수정된 파일

### 1. `lib/data/subjects.ts`

**변경 사항:**
- `SubjectGroup`, `SubjectType`, `Subject` 타입에서 `display_order` 필드 제거
- 모든 쿼리에서 `.order("display_order", { ascending: true })` 제거
- 대신 `.order("name", { ascending: true })`로 정렬 변경
- JOIN 쿼리에서 `display_order` 필드 선택 제거

**주요 함수:**
- `getSubjectGroups()`: `display_order` 정렬 제거
- `getSubjectTypes()`: `display_order` 정렬 제거
- `getSubjectsByGroup()`: `display_order` 정렬 제거
- `getFullSubjectHierarchy()`: `display_order` 정렬 제거
- `getSubjectHierarchyOptimized()`: `display_order` 정렬 및 선택 제거
- `getActiveCurriculumRevision()`: `display_order` 정렬 제거
- `getSubjectById()`: JOIN에서 `display_order` 필드 제거

### 2. `lib/data/contentMetadata.ts`

**변경 사항:**
- `CurriculumRevision`, `Subject` 타입에서 `display_order` 필드 제거
- `getCurriculumRevisions()`: `display_order` 정렬 제거
- `createCurriculumRevision()`: `display_order` 파라미터 제거
- `updateCurriculumRevision()`: `display_order` 업데이트 제거
- `getSubjects()`: `display_order` 정렬 제거
- `createSubject()`: `display_order` 파라미터 제거
- `updateSubject()`: `display_order` 업데이트 제거

### 3. `app/(admin)/actions/subjectActions.ts`

**변경 사항:**
- `createSubjectGroup()`: `display_order` 자동 계산 로직 제거
- `updateSubjectGroup()`: `display_order` 관련 주석 제거
- `createSubject()`: `display_order` 자동 계산 로직 제거
- `updateSubject()`: `display_order` 관련 주석 제거
- `createSubjectType()`: `display_order` 자동 계산 로직 제거
- `updateSubjectType()`: `display_order` 관련 주석 제거

## 🔄 정렬 방식 변경

기존에는 `display_order`로 정렬했지만, 이제는 `name` 필드로 알파벳/한글 순서로 정렬합니다.

**변경 전:**
```typescript
.order("display_order", { ascending: true })
.order("name", { ascending: true })
```

**변경 후:**
```typescript
.order("name", { ascending: true })
```

## ✅ 검증 완료

- [x] TypeScript 타입 정의에서 `display_order` 제거
- [x] 모든 쿼리에서 `display_order` 정렬 제거
- [x] INSERT 쿼리에서 `display_order` 필드 제거
- [x] UPDATE 쿼리에서 `display_order` 필드 제거
- [x] JOIN 쿼리에서 `display_order` 필드 선택 제거
- [x] ESLint 오류 없음

## 📌 참고 사항

- 마이그레이션 파일(`supabase/migrations/`)의 `display_order` 참조는 그대로 유지됩니다 (과거 데이터 참조)
- 다른 테이블(`grades`, `semesters`, `subject_categories`, `platforms`, `publishers` 등)의 `display_order`는 유지됩니다
- 정렬이 필요한 경우 `name` 필드로 정렬하거나, 필요시 클라이언트 측에서 정렬을 수행할 수 있습니다

## 🗓 작업 일자

2025-01-27

## 📦 마이그레이션 파일

`supabase/migrations/20250127120000_remove_display_order_from_education_tables.sql`

이 마이그레이션 파일을 실행하면 다음 테이블에서 `display_order` 컬럼이 제거됩니다:
- `curriculum_revisions`
- `subject_groups`
- `subjects`
- `subject_types`

또한 관련 인덱스도 함께 제거됩니다:
- `idx_curriculum_revisions_display_order` (있다면)
- `idx_subject_groups_display_order` (있다면)
- `idx_subjects_display_order` (있다면)
- `idx_subject_types_display_order`

