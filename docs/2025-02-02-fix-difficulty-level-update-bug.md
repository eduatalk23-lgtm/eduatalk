# 교재 난이도 수정 버그 수정 및 코드 최적화

**작성일**: 2025-02-02  
**관련 파일**: `lib/utils/masterContentFormHelpers.ts`

## 문제 개요

관리자 페이지에서 교재 콘텐츠의 난이도(`difficulty_level_id`) 수정이 반영되지 않는 버그가 발생했습니다.

## 원인 분석

### 버그 발생 흐름

1. `parseMasterBookUpdateFormData` 함수에서 `difficulty_level_id` 필드 처리:
   ```typescript
   difficulty_level_id: getFormUuid(formData, "difficulty_level_id") || undefined,
   ```

2. `getFormUuid` 함수가 빈 문자열일 때 `null` 반환
3. `|| undefined`로 인해 `null`이 `undefined`로 변환됨
4. 마지막 필터에서 `undefined` 값이 제거되어 업데이트 데이터에 포함되지 않음

### 코드 일관성 문제

- `parseMasterBookUpdateFormData`: `difficulty_level_id`에 `|| undefined` 사용 (버그)
- `parseMasterLectureUpdateFormData`: `difficulty_level_id` 직접 사용 (정상)
- `parseMasterCustomContentUpdateFormData`: `difficulty_level_id` 직접 사용 (정상)
- UUID 필드 처리 방식이 일관되지 않음 (`getFormValue` vs `getFormUuid`)

## 수정 내용

### 1. UUID 필드 전용 헬퍼 함수 생성

모든 업데이트 함수에 공통으로 사용할 UUID 필드 전용 헬퍼 함수를 추가했습니다:

```typescript
// UUID 필드 전용 헬퍼: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
// 빈 문자열이면 null 반환 (명시적으로 삭제), 값이 있으면 그대로 반환
const getFormUuidValue = (key: string): string | null | undefined => {
  const value = formData.get(key);
  if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
  const str = value.toString().trim();
  return str === "" ? null : str; // 빈 문자열 → null로 설정 (삭제), 값 있음 → 그대로
};
```

### 2. `parseMasterBookUpdateFormData` 수정

**수정 전**:
```typescript
difficulty_level_id: getFormUuid(formData, "difficulty_level_id") || undefined,
curriculum_revision_id: getFormValue("curriculum_revision_id") || undefined,
subject_id: getFormUuid(formData, "subject_id") || undefined,
publisher_id: getFormValue("publisher_id") || undefined,
```

**수정 후**:
```typescript
difficulty_level_id: getFormUuidValue("difficulty_level_id"),
curriculum_revision_id: getFormUuidValue("curriculum_revision_id"),
subject_id: getFormUuidValue("subject_id"),
publisher_id: getFormUuidValue("publisher_id"),
```

### 3. 다른 업데이트 함수들 일관성 개선

- `parseMasterLectureUpdateFormData`: 모든 UUID 필드에 `getFormUuidValue` 사용
- `parseMasterCustomContentUpdateFormData`: 모든 UUID 필드에 `getFormUuidValue` 사용

## 동작 방식

### 값 처리 로직

1. **값이 있는 경우**: 문자열 값 그대로 반환 → 업데이트됨
2. **빈 문자열인 경우**: `null` 반환 → 명시적 삭제로 처리
3. **필드가 없는 경우**: `undefined` 반환 → 필터링되어 업데이트하지 않음

### 데이터베이스 업데이트

`updateMasterBook` 함수는 `difficulty_level_id`가 `undefined`가 아니면 업데이트하므로:
- 값이 있으면 → 정상 업데이트 ✅
- `null`이면 → `null`로 업데이트 (FK 제약 만족) ✅
- `undefined`면 → 업데이트하지 않음 ✅

## 검증 시나리오

### 시나리오 1: 난이도 선택
- **입력**: `difficulty_level_id = "uuid-value"`
- **결과**: 정상적으로 업데이트됨 ✅

### 시나리오 2: 난이도 제거
- **입력**: `difficulty_level_id = ""` (빈 문자열)
- **결과**: `null`로 설정되어 난이도가 제거됨 ✅

### 시나리오 3: 난이도 미변경
- **입력**: 폼에 `difficulty_level_id` 필드가 없음
- **결과**: 기존 값 유지 (업데이트하지 않음) ✅

## 개선 효과

1. **버그 해결**: 난이도 수정이 정상적으로 반영됨
2. **코드 일관성**: 모든 UUID 필드에 동일한 처리 로직 적용
3. **유지보수성**: 공통 헬퍼 함수로 향후 수정 용이
4. **타입 안전성**: 명확한 `null`/`undefined` 처리로 타입 안전성 향상

## 관련 파일

- `lib/utils/masterContentFormHelpers.ts`: FormData 파싱 헬퍼 함수
- `lib/data/contentMasters.ts`: 데이터베이스 업데이트 함수
- `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`: 교재 수정 폼

## 참고 사항

- `difficulty_level` 필드는 deprecated 상태이며, `difficulty_level_id` 사용을 권장합니다
- 데이터베이스 스키마: `master_books.difficulty_level_id`는 UUID 타입, nullable
- Foreign Key 제약: `difficulty_levels.id` 참조




