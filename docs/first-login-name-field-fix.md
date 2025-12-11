# 첫 로그인 시 name 필드 누락 문제 해결

## 문제

첫 로그인 시 학생 레코드 생성이 실패하는 문제가 발생했습니다.

### 에러 로그

```
[auth] 첫 로그인 시 학생 레코드 생성 실패 {
  userId: 'b54a3bc5-f360-4127-8769-514659f959e7',
  error: 'null value in column "name" of relation "students" violates not-null constraint'
}
```

### 원인

`students` 테이블의 `name` 컬럼이 NOT NULL 제약조건이 있는데, `createStudentRecord()` 함수에서 `name` 필드를 제공하지 않아 발생한 문제입니다.

## 해결 방법

### 1. createStudentRecord() 함수 수정

**변경 사항**:
- `displayName` 파라미터 추가
- INSERT 시 `name` 필드 포함
- `displayName`이 없으면 빈 문자열 사용 (NOT NULL 제약조건 충족)

```typescript
async function createStudentRecord(
  userId: string,
  tenantId: string | null | undefined,
  displayName?: string | null  // 추가
): Promise<{ success: boolean; error?: string }> {
  // ...
  const { error } = await supabase.from("students").insert({
    id: userId,
    tenant_id: finalTenantId,
    name: displayName || "",  // 추가
  });
  // ...
}
```

### 2. ensureUserRecord() 함수 수정

**변경 사항**:
- `user_metadata.display_name` 추출
- `createStudentRecord()` 호출 시 `displayName` 전달

```typescript
async function ensureUserRecord(
  user: { id: string; user_metadata?: Record<string, any> | null }
): Promise<void> {
  // ...
  const displayName = user.user_metadata?.display_name as string | null | undefined;
  
  if (signupRole === "student") {
    // ...
    if (!student) {
      const result = await createStudentRecord(user.id, tenantId, displayName);  // displayName 전달
      // ...
    }
  }
  // ...
}
```

### 3. signUp() 함수 수정

**변경 사항**:
- `validation.data.displayName` 추출
- `createStudentRecord()` 호출 시 `displayName` 전달

```typescript
if (authData.user) {
  const role = validation.data.role;
  const tenantId = validation.data.tenantId || null;
  const displayName = validation.data.displayName;  // 추가

  if (role === "student") {
    const result = await createStudentRecord(authData.user.id, tenantId, displayName);  // displayName 전달
    // ...
  }
}
```

## 검증

### 예상 결과

1. **첫 로그인 시**: `user_metadata.display_name`이 있으면 해당 값 사용, 없으면 빈 문자열 사용
2. **회원가입 시**: `validation.data.displayName` 사용
3. **레코드 생성 성공**: `name` 필드가 포함되어 NOT NULL 제약조건 충족

### 테스트 시나리오

1. **신규 학생 첫 로그인 (display_name 있음)**
   - `user_metadata.display_name` 값이 `name` 필드에 저장됨
   - 레코드 생성 성공

2. **신규 학생 첫 로그인 (display_name 없음)**
   - 빈 문자열이 `name` 필드에 저장됨
   - 레코드 생성 성공 (NOT NULL 제약조건 충족)

3. **회원가입 시**
   - 회원가입 시 입력한 `displayName`이 `name` 필드에 저장됨
   - 레코드 생성 성공

## 관련 파일

- `app/actions/auth.ts`
  - `createStudentRecord()` 함수
  - `ensureUserRecord()` 함수
  - `signUp()` 함수

## 참고 자료

- [로그 분석 문서](./log-analysis-rls-signup-issue.md)
- [첫 로그인 시 레코드 자동 생성 구현 요약](./first-login-record-creation-summary.md)

---

**작성 일자**: 2025-01-31  
**수정 완료**: 2025-01-31  
**상태**: 구현 완료

