# 학생 정보 생성 후 조회 실패 문제 해결

## 문제 상황

학생 페이지의 마이페이지에서 정보를 입력하고 "시작하기" 버튼을 누르면 다음과 같은 에러 메시지가 표시되었습니다:

```
학생 정보 생성 후 조회에 실패했습니다.
```

## 원인 분석

### 1. `getStudentById` 함수의 문제

`lib/data/students.ts`의 `getStudentById` 함수에서:
- `name` 필드가 select 쿼리에 포함되지 않았음
- `executeSingleQuery`와 `maybeSingle()`의 타입 불일치로 인한 잠재적 문제
- 에러 발생 시 상세 로깅이 부족함

### 2. 생성 후 즉시 조회 실패

`app/(student)/actions/studentActions.ts`의 `updateStudentProfile` 함수에서:
- `upsertStudent`로 학생 정보를 생성한 직후 `getStudentById`로 조회
- Supabase의 eventual consistency로 인해 생성 직후 조회 시 데이터가 아직 반영되지 않을 수 있음
- 재시도 로직이 없어서 일시적인 실패가 영구적인 에러로 처리됨

## 해결 방법

### 1. `getStudentById` 함수 개선

**파일**: `lib/data/students.ts`

#### 변경 사항:
- `name` 필드를 select 쿼리에 추가
- `executeSingleQuery` 대신 직접 쿼리 실행으로 변경하여 타입 안정성 향상
- 에러 발생 시 상세 로깅 추가 (studentId, error message, code, details, hint)

```typescript
// 변경 전
return executeSingleQuery<Student>(
  () =>
    supabase
      .from("students")
      .select("id,tenant_id,grade,class,birth_date,...")
      .eq("id", studentId)
      .maybeSingle(),
  {
    context: "[data/students]",
    defaultValue: null,
  }
);

// 변경 후
const { data, error } = await supabase
  .from("students")
  .select("id,tenant_id,name,grade,class,birth_date,...")
  .eq("id", studentId)
  .maybeSingle<Student>();

if (error) {
  if (error.code === "PGRST116") {
    return null; // 레코드가 없는 경우
  }
  console.error("[data/students] 학생 정보 조회 실패", {
    studentId,
    error: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  return null;
}

return data ?? null;
```

### 2. 재시도 로직 추가

**파일**: `app/(student)/actions/studentActions.ts`

#### 변경 사항:
- 학생 정보 생성 후 조회 실패 시 재시도 로직 추가
- 최대 3회 재시도, 각 재시도 간 지연 시간 증가 (100ms, 200ms, 300ms)
- Supabase의 eventual consistency를 고려한 처리

```typescript
// 생성된 학생 정보 다시 조회 (약간의 지연 후 재시도)
let retryCount = 0;
const maxRetries = 3;
const retryDelay = 100; // 100ms

while (retryCount < maxRetries) {
  existingStudent = await getStudentById(user.id);
  if (existingStudent) {
    break;
  }
  
  retryCount++;
  if (retryCount < maxRetries) {
    // 마지막 시도가 아니면 잠시 대기 후 재시도
    await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
  }
}

if (!existingStudent) {
  console.error("[studentActions] 학생 정보 생성 후 조회 실패", {
    userId: user.id,
    retryCount,
    createResult,
  });
  return { success: false, error: "학생 정보 생성 후 조회에 실패했습니다. 잠시 후 다시 시도해주세요." };
}
```

## 테스트 시나리오

1. **정상 케이스**: 학생 정보가 없는 상태에서 마이페이지에서 정보 입력 후 "시작하기" 클릭
   - 예상 결과: 학생 정보 생성 성공, 대시보드로 리다이렉트

2. **재시도 케이스**: 네트워크 지연이나 Supabase eventual consistency로 인한 일시적 실패
   - 예상 결과: 자동으로 재시도하여 성공

3. **영구 실패 케이스**: 실제 데이터베이스 오류
   - 예상 결과: 최대 재시도 후 명확한 에러 메시지 표시

## 관련 파일

- `lib/data/students.ts` - `getStudentById` 함수 개선
- `app/(student)/actions/studentActions.ts` - `updateStudentProfile` 함수에 재시도 로직 추가

## 참고 사항

- Supabase는 eventual consistency를 보장하므로, 생성 직후 조회 시 약간의 지연이 발생할 수 있습니다.
- 재시도 로직은 최대 3회로 제한하여 무한 루프를 방지합니다.
- 에러 로깅을 강화하여 향후 디버깅이 용이하도록 했습니다.

