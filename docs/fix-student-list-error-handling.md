# 학생 목록 조회 에러 처리 개선

## 작업 일시

2024-12-15 (3차 수정)

## 문제 상황

- `StudentInvitationForm` 컴포넌트에서 학생 목록 조회 시 에러가 발생
- 에러 메시지: "학생 목록 조회 실패: {}"
- 에러 객체가 빈 객체로 출력되어 실제 에러 원인 파악 불가

## 원인 분석

1. Supabase 에러 객체가 제대로 직렬화되지 않아 빈 객체로 출력됨
2. 에러 객체의 세부 정보(message, code, details, hint)를 확인하지 않음
3. 데이터가 null인 경우에 대한 처리 부재

## 해결 방법

### 1. 에러 객체 세부 정보 로깅 개선

- 에러 객체의 모든 속성(message, code, details, hint)을 명시적으로 추출하여 로깅
- 에러 객체 자체도 포함하여 디버깅 용이성 향상

```typescript
const errorDetails = {
  message: studentsError.message,
  code: studentsError.code,
  details: studentsError.details,
  hint: studentsError.hint,
  error: studentsError,
};
console.error("학생 목록 조회 실패:", errorDetails);
```

### 2. 에러 메시지 개선

- 에러 메시지가 있는 경우 사용자에게 구체적인 에러 내용 표시
- 에러 메시지가 없는 경우 기본 메시지 표시

```typescript
toast.showError(
  studentsError.message
    ? `학생 목록을 불러오는데 실패했습니다: ${studentsError.message}`
    : "학생 목록을 불러오는데 실패했습니다."
);
```

### 3. null 데이터 체크 추가

- Supabase는 에러가 없어도 data가 null일 수 있음
- null인 경우 빈 배열로 처리하여 컴포넌트가 정상 동작하도록 함

```typescript
if (allStudents === null) {
  console.warn("학생 목록이 null로 반환되었습니다.");
  setStudents([]);
  setLoading(false);
  return;
}
```

### 4. 초대 목록 조회 에러 처리도 동일하게 개선

- 일관된 에러 처리 패턴 적용

## 수정된 파일

- `app/(admin)/admin/camp-templates/[id]/StudentInvitationForm.tsx`

## 개선 효과

1. 에러 발생 시 실제 원인을 파악할 수 있는 상세 정보 제공
2. 사용자에게 더 명확한 에러 메시지 표시
3. null 데이터에 대한 안전한 처리
4. 디버깅 용이성 향상

## 2차 수정 (에러 객체 상세 분석)

### 문제

- 에러 객체가 여전히 빈 객체 `{}`로 출력됨
- 에러 객체의 실제 구조를 파악할 수 없음

### 추가 개선 사항

1. **에러 객체 직렬화**
   - `JSON.stringify`와 `Object.getOwnPropertyNames`를 사용하여 모든 속성 확인
   - 숨겨진 속성도 포함하여 직렬화

2. **에러 객체 상세 분석**
   - 에러 타입 (`typeof`)
   - 에러 생성자 이름 (`constructor.name`)
   - 모든 키와 속성 목록
   - 직렬화된 에러 객체

3. **에러 체크 로직 개선**
   - 단순 truthy 체크 대신 실제 에러 속성 존재 여부 확인
   - `message`, `code`, 또는 객체에 키가 있는지 확인

4. **직렬화 실패 대비**
   - 직렬화 중 에러 발생 시 대체 로깅 제공

```typescript
// 에러 체크: null이 아니고, 실제로 에러 속성이 있는지 확인
if (
  studentsError &&
  (studentsError.message ||
    studentsError.code ||
    Object.keys(studentsError).length > 0)
) {
  const errorDetails = {
    message: studentsError.message || null,
    code: studentsError.code || null,
    details: studentsError.details || null,
    hint: studentsError.hint || null,
    serialized: JSON.stringify(
      studentsError,
      Object.getOwnPropertyNames(studentsError)
    ),
    keys: Object.keys(studentsError),
    allProperties: Object.getOwnPropertyNames(studentsError),
    errorType: typeof studentsError,
    errorConstructor: studentsError.constructor?.name,
    rawError: studentsError,
  };
  console.error("학생 목록 조회 실패:", errorDetails);
}
```

## 3차 수정 (에러 객체 안전한 로깅)

### 문제

- `console.error`가 객체를 출력할 때 빈 객체 `{}`로 표시됨
- 순환 참조나 직렬화 불가능한 속성으로 인한 문제

### 해결 방법

1. **개별 속성 추출**
   - 에러 객체의 각 속성을 개별적으로 추출
   - 순환 참조 방지 및 직렬화 가능한 값만 포함

2. **안전한 직렬화**
   - 객체 속성은 JSON 직렬화 시도
   - 실패 시 문자열로 변환
   - 함수나 순환 참조는 제외

3. **개별 속성 먼저 로깅**
   - 가장 중요한 `message`와 `code`를 먼저 로깅
   - 상세 정보는 별도로 로깅
   - 원본 에러 객체도 함께 로깅

```typescript
// 개별 속성 추출
const errorInfo: Record<string, unknown> = {};
if (studentsError.message) errorInfo.message = studentsError.message;
if (studentsError.code) errorInfo.code = studentsError.code;
// ... 기타 속성

// 안전한 직렬화
Object.keys(studentsError).forEach((key) => {
  const value = (studentsError as Record<string, unknown>)[key];
  if (
    value !== null &&
    typeof value !== "function" &&
    typeof value !== "object"
  ) {
    errorInfo[key] = value;
  } else if (typeof value === "object" && value !== null) {
    try {
      JSON.stringify(value);
      errorInfo[key] = value;
    } catch {
      errorInfo[key] = String(value);
    }
  }
});

// 개별 속성 먼저 로깅
console.error("학생 목록 조회 실패 - 메시지:", studentsError.message || "없음");
console.error("학생 목록 조회 실패 - 코드:", studentsError.code || "없음");
console.error("학생 목록 조회 실패 - 상세 정보:", errorInfo);
console.error("학생 목록 조회 실패 - 원본 에러 객체:", studentsError);
```

## 향후 개선 사항

- RLS 정책 확인 및 권한 문제 해결
- 네트워크 에러 처리 강화
- 재시도 로직 추가 고려
- `handleSupabaseQueryArray` 유틸리티 활용 검토
