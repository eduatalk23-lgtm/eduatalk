# Refresh Token 에러 처리 개선

**작업 일시**: 2025-02-01  
**작업자**: AI Assistant  
**목적**: Supabase 인증에서 발생하는 "Invalid Refresh Token: Refresh Token Not Found" 에러를 조용히 처리하여 불필요한 콘솔 에러 로그 제거

---

## 문제 상황

터미널에서 반복적으로 발생하는 에러:

```
Error [AuthApiError]: Invalid Refresh Token: Refresh Token Not Found
    at ignore-listed frames {
  __isAuthError: true,
  status: 400,
  code: 'refresh_token_not_found'
}
```

### 원인 분석

1. **쿠키에 유효하지 않은 refresh token이 남아있음**
   - 사용자가 로그아웃했거나 세션이 만료된 후에도 쿠키에 refresh token이 남아있을 수 있음
   - 서버 컴포넌트에서 `supabase.auth.getUser()` 호출 시 유효하지 않은 토큰으로 인해 에러 발생

2. **에러 처리 부족**
   - `app/page.tsx`에서 직접 `getUser()` 호출 시 에러 처리 없음
   - `getCurrentUserRole.ts`의 catch 블록에서 refresh token 에러를 명시적으로 필터링하지 않음

3. **여러 곳에서 반복 호출**
   - 루트 페이지, 레이아웃 파일 등에서 `getCurrentUserRole()` 호출
   - 각 호출마다 에러가 발생하여 콘솔에 중복 로그 출력

---

## 해결 방법

### 1. `app/page.tsx` 수정

**변경 내용**:
- `supabase.auth.getUser()` 호출 시 에러 처리 추가
- refresh token 에러는 조용히 처리하고 로그인 페이지로 리다이렉트

```typescript
const { data: { user }, error: getUserError } = await supabase.auth.getUser();

// refresh token 에러는 조용히 처리 (세션이 없는 것으로 간주)
if (getUserError) {
  const errorMessage = getUserError.message?.toLowerCase() || "";
  const errorCode = getUserError.code?.toLowerCase() || "";
  
  const isRefreshTokenError = 
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorMessage.includes("session") ||
    errorCode === "refresh_token_not_found";
  
  if (!isRefreshTokenError) {
    console.error("[auth] getUser 실패", {
      message: getUserError.message,
      status: getUserError.status,
      code: getUserError.code,
    });
  }
  
  // 세션이 없으면 로그인 페이지로 리다이렉트
  redirect("/login");
}
```

### 2. `lib/auth/rateLimitHandler.ts` 수정

**변경 내용**:
- `isRefreshTokenError()` 함수 추가: refresh token 에러를 감지하는 유틸리티 함수
- `isRetryableError()` 수정: refresh token 에러는 재시도 불가능하도록 수정
- `retryWithBackoff()` 수정: refresh token 에러는 즉시 반환하도록 수정

```typescript
export function isRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const err = error as ErrorWithCode;
  const errorMessage = err.message?.toLowerCase() || "";
  const errorCode = err.code?.toLowerCase() || "";
  
  return (
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorMessage.includes("session") ||
    errorCode === "refresh_token_not_found"
  );
}
```

### 3. `lib/auth/getCurrentUserRole.ts` 수정

**변경 내용**:
- refresh token 에러를 먼저 체크하여 즉시 반환 (재시도 불필요)
- Rate limit 에러인 경우에만 재시도
- refresh token 에러는 조용히 처리하고 null 반환

```typescript
} catch (error) {
  // refresh token 에러는 조용히 처리
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isRefreshTokenError = 
    errorMessage.toLowerCase().includes("refresh token") ||
    errorMessage.toLowerCase().includes("refresh_token") ||
    errorMessage.toLowerCase().includes("session") ||
    (error instanceof Error && 
     'code' in error && 
     String(error.code).toLowerCase() === "refresh_token_not_found");
  
  if (!isRefreshTokenError) {
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[auth] getCurrentUserRole 실패", {
      message: errorMessage,
      stack: errorStack,
    });
  }
  
  return { userId: null, role: null, tenantId: null };
}
```

### 4. `lib/auth/getCurrentUser.ts` 수정

**변경 내용**:
- refresh token 에러를 먼저 체크하여 즉시 반환 (재시도 불필요)
- Rate limit 에러인 경우에만 재시도
- refresh token 에러는 조용히 처리하고 null 반환

---

## 수정된 파일 목록

1. `app/page.tsx`
   - `getUser()` 호출 시 에러 처리 추가
   - refresh token 에러 시 로그인 페이지로 리다이렉트

2. `lib/auth/rateLimitHandler.ts`
   - `isRefreshTokenError()` 함수 추가
   - `isRetryableError()`에서 refresh token 에러는 재시도 불가능하도록 수정
   - `retryWithBackoff()`에서 refresh token 에러는 즉시 반환하도록 수정

3. `lib/auth/getCurrentUserRole.ts`
   - refresh token 에러를 먼저 체크하여 즉시 반환
   - Rate limit 에러인 경우에만 재시도
   - refresh token 에러는 조용히 처리

4. `lib/auth/getCurrentUser.ts`
   - refresh token 에러를 먼저 체크하여 즉시 반환
   - Rate limit 에러인 경우에만 재시도
   - refresh token 에러는 조용히 처리

---

## 에러 처리 전략

### Refresh Token 에러를 조용히 처리하는 이유

1. **정상적인 상황일 수 있음**
   - 사용자가 로그아웃한 후 쿠키에 남아있는 토큰
   - 세션이 만료된 후 자동 갱신 실패
   - 개발 환경에서 쿠키가 손상된 경우

2. **사용자 경험 개선**
   - 불필요한 에러 로그로 인한 콘솔 오염 방지
   - 실제 문제가 아닌 경우 에러 로그로 오해 방지

3. **일관된 처리**
   - `getCurrentUser()`, `getCurrentUserRole()` 모두 동일한 방식으로 처리
   - 세션이 없는 경우 null 반환 또는 로그인 페이지로 리다이렉트

### 에러 필터링 기준

다음 조건 중 하나라도 만족하면 refresh token 에러로 간주:

1. 에러 메시지에 "refresh token" 또는 "refresh_token" 포함
2. 에러 메시지에 "session" 포함
3. 에러 코드가 "refresh_token_not_found"

---

## 테스트 시나리오

### 1. 정상 로그인
- ✅ 사용자가 로그인하면 정상적으로 인증됨
- ✅ refresh token 에러가 발생하지 않음

### 2. 로그아웃 후 접근
- ✅ 쿠키에 남아있는 유효하지 않은 토큰으로 인한 에러가 조용히 처리됨
- ✅ 로그인 페이지로 리다이렉트됨
- ✅ 콘솔에 에러 로그가 출력되지 않음

### 3. 세션 만료
- ✅ 세션이 만료된 후 자동 갱신 실패 시 조용히 처리됨
- ✅ 사용자는 로그인 페이지로 리다이렉트됨

### 4. 실제 인증 에러
- ✅ refresh token 에러가 아닌 다른 인증 에러는 정상적으로 로깅됨
- ✅ 디버깅에 필요한 정보가 유지됨

---

## 예상 효과

1. **콘솔 에러 로그 감소**
   - 불필요한 refresh token 에러 로그 제거
   - 실제 문제 파악이 쉬워짐

2. **사용자 경험 개선**
   - 세션이 없는 경우 자연스럽게 로그인 페이지로 이동
   - 에러 메시지 없이 정상적인 플로우 유지

3. **코드 일관성 향상**
   - 모든 인증 관련 함수에서 동일한 에러 처리 방식 적용
   - 유지보수성 개선

---

## 참고 사항

- Supabase의 `@supabase/ssr` 패키지는 자동으로 refresh token을 관리합니다
- 서버 컴포넌트에서는 쿠키를 읽기 전용으로만 사용하므로, 토큰 갱신은 클라이언트 사이드에서 처리됩니다
- 유효하지 않은 refresh token이 쿠키에 남아있는 것은 정상적인 상황일 수 있으며, 이를 조용히 처리하는 것이 적절합니다

---

## 관련 파일

- `app/page.tsx` - 루트 페이지
- `lib/auth/getCurrentUser.ts` - 현재 사용자 정보 조회
- `lib/auth/getCurrentUserRole.ts` - 현재 사용자 역할 조회
- `lib/supabase/server.ts` - Supabase 서버 클라이언트 생성

