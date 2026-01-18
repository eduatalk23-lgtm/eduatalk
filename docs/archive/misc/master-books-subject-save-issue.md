# master_books 교과/과목 정보 저장 문제 분석

## 📋 문제 상황

교재 등록 시 입력한 교과, 과목 정보가 테이블에 저장되지 않는 것으로 보임.

## 🔍 현재 구현 분석

### 1. 폼 구조 (`MasterBookForm.tsx`)

```typescript
// 교과 그룹 선택 (UI용, 저장 안 됨)
<select
  value={selectedGroupId}
  onChange={handleSubjectGroupChange}
  // ❌ name 속성이 없음 - FormData에 포함되지 않음
>

// 과목 선택
<select
  name="subject_id"  // ✅ FormData에 포함됨
  disabled={!selectedGroupId}
>
```

**문제점**:
- 교과 그룹 선택은 `name` 속성이 없어 FormData에 포함되지 않음
- 과목 선택은 `subject_id`만 FormData에 포함됨

### 2. 액션 함수 (`addMasterBook`)

```typescript:45:51:app/(student)/actions/masterContentActions.ts
const subjectId = formData.get("subject_id")?.toString() || null;

const bookData = {
  // ...
  subject_id: subjectId,  // ✅ 저장됨
  // ❌ subject_category, subject는 저장되지 않음 (스키마에 컬럼 없음)
};
```

### 3. 실제 스키마

```sql
master_books 테이블:
- subject_id (uuid, FK → subjects.id)  ✅ 있음
- subject_category (컬럼 없음)  ❌
- subject (컬럼 없음)  ❌
```

**현재 설계**:
- `subject_id`만 FK로 저장
- `subject_category`와 `subject`는 JOIN으로 가져옴

## ✅ 해결 방안

### 옵션 1: 현재 설계 유지 (권장)

현재 설계가 올바릅니다:
- `subject_id`만 저장 (FK)
- 상세 보기에서 JOIN으로 `subject_category`, `subject` 가져옴

**확인 필요**:
- `subject_id`가 실제로 저장되는지 확인
- 폼에서 `subject_id`가 제대로 전송되는지 확인

### 옵션 2: 디버깅 로그 추가

`subject_id` 저장 여부를 확인하기 위한 로그 추가:

```typescript
const subjectId = formData.get("subject_id")?.toString() || null;
console.log("[addMasterBook] subject_id:", subjectId);  // 디버깅

const bookData = {
  // ...
  subject_id: subjectId,
};
console.log("[addMasterBook] bookData.subject_id:", bookData.subject_id);  // 디버깅
```

## 🔧 수정 사항

### 1. 폼에서 `subject_id` 전송 확인

현재 코드는 정상적으로 보이지만, 실제로 값이 전송되는지 확인 필요.

### 2. 저장 후 검증

교재 저장 후 `subject_id`가 실제로 저장되었는지 확인하는 로직 추가.

---

## 📅 작성일
2025-01-XX

