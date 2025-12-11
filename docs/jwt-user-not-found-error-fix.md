# JWT "User from sub claim does not exist" 에러 처리 개선

**작성 일자**: 2025-01-31  
**문제**: 로그인 페이지에서 "User from sub claim in JWT does not exist" 에러 발생  
**원인**: 이메일 인증 전이나 세션이 없을 때 발생하는 정상적인 상황이지만, 에러 로그로 표시됨

---

## 문제 상황

### 에러 메시지

```
[auth] getUser 실패 {
  message: 'User from sub claim in JWT does not exist',
  status: 403,
  code: 'user_not_found',
  name: 'AuthApiError'
}
```

### 발생 위치

- `lib/auth/getCurrentUserRole.ts` - `getUser()` 호출 시
- `lib/auth/getCurrentUser.ts` - `getUser()` 호출 시
- `app/login/page.tsx` - 로그인 페이지 렌더링 시

---

## 원인 분석

### 1. 에러 발생 시나리오

이 에러는 다음 상황에서 발생할 수 있습니다:

1. **이메일 인증 전에 로그인을 시도할 때** (정상적인 상황)
   - 회원가입 후 이메일 인증을 완료하지 않은 상태
   - 로그인 페이지에 접근할 때 세션이 없는 상태

2. **JWT 토큰이 만료되었거나 손상되었을 때**
   - 오래된 세션 토큰
   - 손상된 쿠키

3. **사용자 레코드가 제대로 생성되지 않았을 때**
   - `parent_users` 또는 `students` 레코드 생성 실패

### 2. 기존 에러 처리

기존 코드에서는 세션/토큰 관련 에러만 조용히 처리하고 있었습니다:

```typescript
// 기존 코드
const isSessionMissing =
  errorMessage.includes("session") ||
  errorMessage.includes("refresh token") ||
  errorMessage.includes("refresh_token");
```

"User from sub claim in JWT does not exist" 에러는 처리되지 않아서 에러 로그로 표시되었습니다.

---

## 해결 방법

### 1. `getCurrentUserRole` 함수 수정

`lib/auth/getCurrentUserRole.ts`에서 "User from sub claim" 에러를 명시적으로 처리하도록 수정했습니다:

```typescript
// "User from sub claim in JWT does not exist" 에러 처리
const isUserNotFound =
  errorCode === "user_not_found" ||
  errorMessage.includes("user from sub claim") ||
  errorMessage.includes("user from sub claim in jwt does not exist") ||
  (authError.status === 403 && errorMessage.includes("does not exist"));

if (!isSessionMissing && !isUserNotFound) {
  // 세션/토큰/사용자 없음 관련이 아닌 다른 에러만 로깅
  const errorDetails = {
    message: authError.message,
    status: authError.status,
    code: authError.code,
    name: authError.name,
  };
  console.error("[auth] getUser 실패", errorDetails);
}
```

### 2. `getCurrentUser` 함수 수정

`lib/auth/getCurrentUser.ts`에서도 동일한 처리를 추가했습니다:

```typescript
// "User from sub claim in JWT does not exist" 에러 처리
const isUserNotFound =
  errorCode === "user_not_found" ||
  errorMessage.includes("user from sub claim") ||
  errorMessage.includes("user from sub claim in jwt does not exist") ||
  (authError.status === 403 && errorMessage.includes("does not exist"));

// refresh token 에러나 사용자 없음 에러가 아닌 경우에만 로깅
if (!isRefreshTokenError && !isUserNotFound) {
  console.error("[auth] getCurrentUser: getUser 실패", {
    message: authError.message,
    status: authError.status,
    code: authError.code,
  });
}
```

---

## 수정된 파일

- `lib/auth/getCurrentUserRole.ts` - "User from sub claim" 에러 처리 추가
- `lib/auth/getCurrentUser.ts` - "User from sub claim" 에러 처리 추가

---

## 효과

### Before

```
[auth] getUser 실패 {
  message: 'User from sub claim in JWT does not exist',
  status: 403,
  code: 'user_not_found',
  name: 'AuthApiError'
}
```

### After

에러가 조용히 처리되어 로그인 페이지가 정상적으로 표시됩니다. 이 에러는 정상적인 상황(세션이 없거나 이메일 인증 전)이므로 사용자에게 영향을 주지 않습니다.

---

## 관련 문서

- `docs/parent-users-name-column-fix.md` - `parent_users` 레코드 생성 문제 해결
- `docs/refresh-token-error-fix.md` - Refresh token 에러 처리

---

**마지막 업데이트**: 2025-01-31

