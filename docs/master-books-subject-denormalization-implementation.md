# Master Books 과목 필드 Denormalization 구현 완료

## 개요

개정교육과정 필드와 동일한 패턴으로 과목 필드를 처리하도록 개선했습니다. `publisher_name`처럼 `subject_category`와 `subject`를 denormalize하여 저장하고, 등록/수정 폼에서는 hidden input으로 ID를 전송하도록 변경했습니다.

## 구현 내용

### 1. 스키마 마이그레이션 ✅

**파일**: `supabase/migrations/20251130165605_add_subject_denormalized_fields_to_master_books.sql`

- `master_books` 테이블에 3개의 새 컬럼 추가:
  - `subject_group_id uuid` - 교과 그룹 ID (FK → subject_groups)
  - `subject_category text` - 교과 그룹명 (denormalized)
  - `subject text` - 과목명 (denormalized)
- 기존 데이터 업데이트: `subject_id`로 JOIN하여 값 채우기
- 인덱스 생성: `subject_group_id`에 대한 인덱스

### 2. 타입 정의 업데이트 ✅

**파일**: `lib/types/plan.ts`

```typescript
export type MasterBook = CommonContentFields & {
  // 교육과정 관련
  curriculum_revision_id: string | null;
  subject_id: string | null;
  subject_group_id: string | null; // 추가
  subject_category: string | null; // 추가
  subject: string | null;          // 추가
  // ...
};
```

### 3. 등록 폼 개선 ✅

**파일**: `app/(admin)/admin/master-books/new/MasterBookForm.tsx`

- `selectedSubjectId` state 추가
- 과목 select를 개정교육과정 패턴으로 변경:
  - select에는 과목 이름 표시 (`value={selectedSubjects.find(s => s.id === selectedSubjectId)?.name || ""}`)
  - hidden input으로 `subject_id` 전송
- `handleSubjectChange` 함수 추가 (이름 → ID 변환)
- `handleSubmit`에서 denormalize 필드 저장:
  - `subject_group_id`, `subject_category` (교과 그룹 정보)
  - `subject` (과목 이름)
- disabled select 수동 추가 로직 제거 (hidden input 사용으로 불필요)

### 4. 수정 폼 개선 ✅

**파일**: `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`

- `selectedSubjectId` state 추가 및 `book.subject_id`로 초기화
- 과목 select를 개정교육과정 패턴으로 변경:
  - `defaultValue` 대신 `value`와 `onChange` 사용
  - select에는 과목 이름 표시
  - hidden input으로 `subject_id` 전송
- `useEffect`에서 `book.subject_id`로 교과 그룹과 과목 찾기:
  - `currentSubject`가 없어도 `book.subject_id`로 초기화 가능
  - `book.subject_id` 우선, `currentSubject`는 fallback
- `handleSubmit`에서 denormalize 필드 저장
- disabled select 수동 추가 로직 제거

### 5. 서버 액션 수정 ✅

**파일**: `app/(student)/actions/masterContentActions.ts`

#### `addMasterBook`
```typescript
const bookData: Omit<MasterBook, "id" | "created_at" | "updated_at"> = {
  // ...
  subject_id: subjectId,
  subject_group_id: formData.get("subject_group_id")?.toString() || null,
  subject_category: formData.get("subject_category")?.toString() || null,
  subject: formData.get("subject")?.toString() || null,
  // ...
};
```

#### `updateMasterBookAction`
```typescript
const updateData: Partial<Omit<MasterBook, "id" | "created_at" | "updated_at">> = {
  // ...
  subject_id: subjectId || undefined,
  subject_group_id: formData.get("subject_group_id")?.toString() || undefined,
  subject_category: formData.get("subject_category")?.toString() || undefined,
  subject: formData.get("subject")?.toString() || undefined,
  // ...
};
```

### 6. 데이터 레이어 수정 ✅

**파일**: `lib/data/contentMasters.ts`

#### `createMasterBook`
```typescript
.insert({
  // ...
  subject_id: data.subject_id,
  subject_group_id: data.subject_group_id,
  subject_category: data.subject_category,
  subject: data.subject,
  // ...
})
```

#### `updateMasterBook`
```typescript
if (data.subject_id !== undefined) updateFields.subject_id = data.subject_id;
if (data.subject_group_id !== undefined) updateFields.subject_group_id = data.subject_group_id;
if (data.subject_category !== undefined) updateFields.subject_category = data.subject_category;
if (data.subject !== undefined) updateFields.subject = data.subject;
```

#### `getMasterBookById`
- SELECT에 새 필드 추가: `subject_group_id`, `subject_category`, `subject`
- 저장된 값 우선 사용, JOIN은 fallback:
```typescript
const book = {
  ...bookData,
  // subject_category는 저장된 값 우선, JOIN은 fallback
  subject_category: bookData.subject_category || subjectGroup?.name || null,
  // subject는 저장된 값 우선, JOIN은 fallback
  subject: bookData.subject || subject?.name || null,
  // ...
};
```

## 예상 효과

### 1. 일관성 확보 ✨
- 개정교육과정 필드와 동일한 패턴으로 처리
- 코드 일관성 및 유지보수성 향상

### 2. 성능 향상 🚀
- `publisher_name`처럼 denormalize하여 JOIN 없이 바로 표시 가능
- 저장된 값 우선 사용, JOIN은 fallback

### 3. 사용자 경험 개선 ✅
- 수정 폼에서 `book.subject_id`로 직접 초기화 가능 (`currentSubject` 불필요)
- 상세보기에서 과목 정보가 항상 표시됨
- disabled select 수동 추가 로직 제거로 코드 단순화

## 테스트 체크리스트

- [ ] 교재 등록: 교과 그룹과 과목 선택 → 저장 확인
- [ ] 교재 수정: 기존 과목이 선택된 상태로 표시 확인
- [ ] 교재 상세보기: 교과 그룹과 과목 정보 표시 확인
- [ ] 개정교육과정 변경 시 교과 그룹과 과목 초기화 확인
- [ ] 교과 그룹 변경 시 과목 초기화 확인
- [ ] 기존 데이터 마이그레이션 확인 (기존 교재의 교과/과목 정보)

## 참고 문서

- 프로젝트 구조: `.cursor/rules/project_rule.mdc`
- 개발 가이드라인: `.cursor/rules/project_rule.mdc`
- 스키마 정의: `docs/교육과정-교과-과목-과목구분-테이블-구조.md`

