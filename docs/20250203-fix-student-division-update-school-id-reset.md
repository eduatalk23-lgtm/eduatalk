# 학생 구분 필드 업데이트 시 학교 정보 초기화 문제 수정

## 문제 상황

관리자 페이지에서 학생의 구분(division) 필드를 업데이트할 때, 학교 정보(school_id)가 초기화되는 문제가 발생했습니다.

### 재현 방법
1. 관리자 페이지에서 학생 상세 페이지 접근
2. 구분 필드만 변경하여 저장
3. 학교 정보가 초기화됨

## 원인 분석

`app/(admin)/actions/studentManagementActions.ts`의 `updateStudentInfo` 함수에서:

```typescript
school_id: payload.basic.school_id,
```

이 부분에서 `payload.basic.school_id`가 `undefined`인 경우, `upsertStudent` 함수에 `undefined`가 전달되고, `upsertStudent` 함수 내부에서:

```typescript
school_id: student.school_id ?? null,
```

이렇게 처리되어 `undefined`가 `null`로 변환되어 기존 값이 초기화되었습니다.

### 문제가 발생한 이유

`transformFormDataToUpdatePayload` 함수는 변경된 필드(dirtyFields)만 페이로드에 포함시킵니다. 구분 필드만 변경한 경우, `school_id`는 `dirtyFields`에 포함되지 않아 페이로드에 포함되지 않습니다. 하지만 `updateStudentInfo`에서 `payload.basic.school_id`를 직접 전달하면 `undefined`가 전달되어 기존 값이 유지되지 않았습니다.

## 수정 내용

### 1. `updateStudentInfo` 함수 수정

`app/(admin)/actions/studentManagementActions.ts`의 `updateStudentInfo` 함수에서:

- `school_id`: `undefined`인 경우 기존 값 유지
- `division`: `undefined`인 경우 기존 값 유지  
- `status`: `undefined`인 경우 기존 값 유지

```typescript
const basicResult = await upsertStudent({
  id: studentId,
  tenant_id: existingStudent.tenant_id ?? null,
  name: payload.basic.name,
  grade: payload.basic.grade ?? existingStudent.grade ?? "",
  class: payload.basic.class ?? existingStudent.class ?? "",
  birth_date: payload.basic.birth_date ?? existingStudent.birth_date ?? "",
  school_id: payload.basic.school_id !== undefined 
    ? payload.basic.school_id 
    : existingStudent.school_id ?? null,
  division: payload.basic.division !== undefined
    ? payload.basic.division
    : existingStudent.division ?? null,
  status: payload.basic.status !== undefined
    ? payload.basic.status
    : existingStudent.status ?? null,
});
```

## 수정 파일

- `app/(admin)/actions/studentManagementActions.ts`

## 테스트 방법

1. 관리자 페이지에서 학생 상세 페이지 접근
2. 학교 정보가 설정된 학생 선택
3. 구분 필드만 변경하여 저장
4. 학교 정보가 유지되는지 확인

## 관련 이슈

- 학생 정보 업데이트 시 일부 필드만 변경할 때 다른 필드가 초기화되는 문제

## 참고

- `transformFormDataToUpdatePayload` 함수는 변경된 필드만 페이로드에 포함시키는 방식으로 동작합니다.
- 서버 액션에서는 `undefined`와 명시적인 `null`을 구분하여 처리해야 합니다.
- `undefined`는 "변경하지 않음"을 의미하고, `null`은 "명시적으로 null로 설정"을 의미합니다.

