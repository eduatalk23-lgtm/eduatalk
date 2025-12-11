# parent_users 테이블 name 컬럼 NOT NULL 제약조건 문제 해결

**작성 일자**: 2025-01-31  
**문제**: 회원가입 시 `parent_users` 레코드 생성 실패  
**원인**: `parent_users` 테이블에 `name` 컬럼이 NOT NULL 제약조건이 있는데, 레코드 생성 시 `name` 필드를 포함하지 않음

---

## 문제 상황

### 에러 메시지

```
[auth] 학부모 레코드 생성 실패 {
  userId: 'f5b3c9b8-a0e5-4118-96fd-66a55ac1e36b',
  tenantId: '84b71a5d-5681-4da3-88d2-91e75ef89015',
  error: 'null value in column "name" of relation "parent_users" violates not-null constraint',
  code: '23502'
}
```

### 발생 위치

- `app/actions/auth.ts`의 `createParentRecord` 함수
- 회원가입 시 (`signUp` 함수)
- 첫 로그인 시 (`ensureUserRecord` 함수)

---

## 원인 분석

### 1. 데이터베이스 스키마

실제 데이터베이스의 `parent_users` 테이블에는 `name` 컬럼이 NOT NULL 제약조건이 있습니다. 하지만 ERD 문서(`timetable/erd-cloud/01_core_tables.sql`)에는 `name` 컬럼이 없습니다.

### 2. 코드 문제

`createParentRecord` 함수에서 `name` 필드를 포함하지 않고 레코드를 생성하려고 했습니다:

```typescript
// ❌ 문제가 있던 코드
const { error } = await supabase.from("parent_users").insert({
  id: userId,
  tenant_id: finalTenantId ?? null,
  // name 필드가 없음!
});
```

### 3. 비교: students 테이블

`createStudentRecord` 함수는 이미 `name` 필드를 포함하고 있습니다:

```typescript
// ✅ 올바른 코드 (students)
const { error } = await supabase.from("students").insert({
  id: userId,
  tenant_id: finalTenantId,
  name: displayName || "", // name 필드 포함
});
```

---

## 해결 방법

### 1. `createParentRecord` 함수 수정

`displayName` 파라미터를 추가하고, `name` 필드를 포함하도록 수정했습니다:

```typescript
async function createParentRecord(
  userId: string,
  tenantId: string | null | undefined,
  displayName?: string | null  // ✅ displayName 파라미터 추가
): Promise<{ success: boolean; error?: string }> {
  // ...
  const { error } = await supabase.from("parent_users").insert({
    id: userId,
    tenant_id: finalTenantId ?? null,
    name: displayName || "", // ✅ name 필드 추가
  });
  // ...
}
```

### 2. 호출부 수정

#### `signUp` 함수

```typescript
// ✅ 수정 후
} else if (role === "parent") {
  const result = await createParentRecord(authData.user.id, tenantId, displayName);
  // ...
}
```

#### `ensureUserRecord` 함수

```typescript
// ✅ 수정 후
if (!parent) {
  const result = await createParentRecord(user.id, tenantId, displayName);
  // ...
}
```

---

## 수정된 파일

- `app/actions/auth.ts`
  - `createParentRecord` 함수: `displayName` 파라미터 추가 및 `name` 필드 포함
  - `signUp` 함수: `createParentRecord` 호출 시 `displayName` 전달
  - `ensureUserRecord` 함수: `createParentRecord` 호출 시 `displayName` 전달

---

## 관련 에러

### JWT 인증 에러

터미널 로그에서 다음 에러도 확인되었습니다:

```
[auth] getUser 실패 {
  message: 'User from sub claim in JWT does not exist',
  status: 403,
  code: 'user_not_found',
  name: 'AuthApiError'
}
```

이 에러는 일반적으로:
1. **이메일 인증 전에 로그인을 시도할 때** 발생 (정상적인 상황)
2. JWT 토큰이 만료되었거나 손상되었을 때 발생
3. 사용자 레코드가 제대로 생성되지 않았을 때 발생

### 해결 방법

`getCurrentUserRole` 및 `getCurrentUser` 함수에서 "User from sub claim in JWT does not exist" 에러를 명시적으로 처리하도록 수정했습니다:

```typescript
// "User from sub claim in JWT does not exist" 에러 처리
const isUserNotFound =
  errorCode === "user_not_found" ||
  errorMessage.includes("user from sub claim") ||
  errorMessage.includes("user from sub claim in jwt does not exist") ||
  (authError.status === 403 && errorMessage.includes("does not exist"));
```

이제 이 에러는 조용히 처리되어 로그인 페이지가 정상적으로 표시됩니다.

---

## 테스트 체크리스트

- [ ] 학부모 회원가입 시 `parent_users` 레코드가 정상적으로 생성되는지 확인
- [ ] 이메일 인증 후 첫 로그인 시 `parent_users` 레코드가 정상적으로 생성되는지 확인
- [ ] `name` 필드가 빈 문자열로 저장되는지 확인 (displayName이 없는 경우)
- [ ] `name` 필드가 displayName으로 저장되는지 확인 (displayName이 있는 경우)

---

## 참고 문서

- `docs/students-parents-core-tables.md` - 학생 및 학부모 테이블 구조
- `docs/rls-policy-improvement-todo.md` - RLS 정책 개선 문서
- `app/actions/auth.ts` - 인증 관련 액션

---

**마지막 업데이트**: 2025-01-31

