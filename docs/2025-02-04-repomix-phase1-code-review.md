# Repomix Phase 1 코드 리뷰 및 개선 제안

**작업 일시**: 2025-02-04  
**Phase**: 1 - 핵심 인프라 코드 리뷰

---

## 📋 개요

Phase 1 분석 결과를 바탕으로 핵심 인프라 코드(`lib/supabase/`, `lib/auth/`)를 검토하고 개선 사항을 제안합니다.

---

## ✅ 긍정적인 점

### 1. 타입 안전성

- ✅ **`any` 타입 사용 없음**: 모든 코드에서 명시적 타입 사용
- ✅ **타입 정의 완성도**: Supabase 타입을 적절히 활용
- ✅ **타입 가드 활용**: `instanceof Error` 체크 등 적절히 사용

### 2. 에러 핸들링

- ✅ **에러 처리 로직 존재**: Rate limit, Refresh token 에러 등 구분 처리
- ✅ **재시도 메커니즘**: `retryWithBackoff` 함수로 재시도 로직 구현
- ✅ **에러 로깅**: 적절한 에러 로깅 및 디버깅 정보 제공

### 3. 보안

- ✅ **Service Role Key 보호**: Admin 클라이언트는 서버 전용
- ✅ **환경 변수 검증**: 개발/프로덕션 환경별 처리
- ✅ **RLS 고려**: Admin 클라이언트 사용 시 주의사항 명시

---

## 🔍 개선 필요 사항

### 1. 코드 중복 제거

#### 문제점

`getCurrentUser.ts`와 `getCurrentUserRole.ts`에서 에러 처리 로직이 중복됩니다.

**중복되는 패턴**:

- Refresh token 에러 체크
- Rate limit 에러 처리
- User not found 에러 처리
- 에러 로깅 로직

**예시**:

```typescript
// getCurrentUser.ts (24-38줄)
const isRefreshTokenError =
  errorMessage.includes("refresh token") ||
  errorMessage.includes("refresh_token") ||
  errorMessage.includes("session") ||
  errorCode === "refresh_token_not_found";

// getCurrentUserRole.ts (60-64줄) - 동일한 로직
const isRefreshTokenError =
  errorMessage.includes("refresh token") ||
  errorMessage.includes("refresh_token") ||
  errorMessage.includes("session") ||
  errorCode === "refresh_token_not_found";
```

**개선 방안**:

- `rateLimitHandler.ts`에 이미 `isRefreshTokenError` 함수가 있으므로 이를 활용
- 공통 에러 처리 함수 추출

---

### 2. 프로덕션 로깅 개선

#### 문제점

`getCurrentUserRole.ts`에 디버깅용 `console.log`가 프로덕션 코드에 남아있습니다.

**위치**:

- 225-229줄: `console.log("[getCurrentUserRole] admin_users 조회 결과:")`
- 233줄: `console.log("[getCurrentUserRole] superadmin으로 인식")`
- 240줄: `console.log("[getCurrentUserRole] admin/consultant로 인식:")`
- 322줄: `console.log("[auth] 테이블 레코드 없음, signup_role fallback 사용")`

**개선 방안**:

- 개발 환경에서만 로깅하도록 조건부 처리
- 또는 `console.debug`로 변경하여 프로덕션에서 자동 필터링

---

### 3. 에러 처리 패턴 통일

#### 문제점

에러 처리 방식이 함수마다 약간씩 다릅니다.

**예시**:

- `getCurrentUser`: `errorMessage.toLowerCase()` 사용
- `getCurrentUserRole`: `error.message?.toLowerCase()` 사용
- 일부는 `error.code`, 일부는 `error.status` 우선 체크

**개선 방안**:

- 공통 에러 처리 유틸리티 함수 생성
- 에러 타입별 처리 로직 통일

---

### 4. 타입 정의 개선

#### 문제점

일부 타입 단언(`as`)이 과도하게 사용됩니다.

**예시**:

```typescript
// getCurrentUserRole.ts (188-195줄)
const signupRole = user.user_metadata?.signup_role as string | null | undefined;
```

**개선 방안**:

- Supabase 타입에서 `user_metadata` 타입을 명시적으로 정의
- 타입 가드 함수 활용

---

### 5. 함수 복잡도 관리

#### 문제점

`getCurrentUserRole.ts` 함수가 373줄로 매우 깁니다.

**개선 방안**:

- 역할별 조회 로직을 별도 함수로 분리
- 에러 처리 로직을 헬퍼 함수로 추출

---

## 🛠 구체적인 개선 제안

### 제안 1: 공통 에러 처리 유틸리티 강화

**파일**: `lib/auth/errorHandlers.ts` (신규 생성)

```typescript
import type { SupabaseErrorLike } from "./rateLimitHandler";

export interface AuthErrorInfo {
  isRefreshTokenError: boolean;
  isUserNotFound: boolean;
  isSessionMissing: boolean;
  shouldLog: boolean;
}

/**
 * 인증 에러 분석 및 처리 정보 반환
 */
export function analyzeAuthError(error: unknown): AuthErrorInfo {
  if (!error || typeof error !== "object") {
    return {
      isRefreshTokenError: false,
      isUserNotFound: false,
      isSessionMissing: false,
      shouldLog: true,
    };
  }

  const err = error as SupabaseErrorLike;
  const errorMessage = err.message?.toLowerCase() || "";
  const errorCode = err.code?.toLowerCase() || "";
  const errorName = err.name?.toLowerCase() || "";

  const isRefreshTokenError =
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorMessage.includes("session") ||
    errorCode === "refresh_token_not_found";

  const isUserNotFound =
    errorCode === "user_not_found" ||
    errorMessage.includes("user from sub claim") ||
    errorMessage.includes("user from sub claim in jwt does not exist") ||
    (err.status === 403 && errorMessage.includes("does not exist"));

  const isSessionMissing =
    errorMessage.includes("session") ||
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorName === "authsessionmissingerror" ||
    (errorName === "authapierror" &&
      (errorMessage.includes("refresh token not found") ||
        errorMessage.includes("invalid refresh token") ||
        errorMessage.includes("refresh token expired")));

  // Refresh token 에러나 User not found는 조용히 처리
  const shouldLog = !isRefreshTokenError && !isUserNotFound;

  return {
    isRefreshTokenError,
    isUserNotFound,
    isSessionMissing,
    shouldLog,
  };
}
```

---

### 제안 2: 프로덕션 로깅 개선

**파일**: `lib/auth/getCurrentUserRole.ts`

```typescript
// 기존
console.log("[getCurrentUserRole] admin_users 조회 결과:", {...});

// 개선
if (process.env.NODE_ENV === "development") {
  console.log("[getCurrentUserRole] admin_users 조회 결과:", {...});
}
```

또는 로깅 유틸리티 함수 생성:

```typescript
// lib/utils/logger.ts
export function devLog(message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.log(message, ...args);
  }
}
```

---

### 제안 3: 함수 분리

**파일**: `lib/auth/getCurrentUserRole.ts`

```typescript
// 역할별 조회 로직을 별도 함수로 분리
async function fetchAdminRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  role: "admin" | "consultant" | "superadmin";
  tenantId: string | null;
} | null> {
  // admin_users 조회 로직
}

async function fetchParentRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ role: "parent"; tenantId: null } | null> {
  // parent_users 조회 로직
}

async function fetchStudentRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ role: "student"; tenantId: string | null } | null> {
  // students 조회 로직
}
```

---

## 📊 우선순위별 개선 계획

### 높은 우선순위

1. ✅ **프로덕션 로깅 개선** - 즉시 적용 가능, 영향도 낮음
2. ✅ **공통 에러 처리 유틸리티** - 코드 중복 제거, 유지보수성 향상

### 중간 우선순위

3. ⚠️ **함수 분리** - 가독성 향상, 테스트 용이성 증가
4. ⚠️ **타입 정의 개선** - 타입 안전성 강화

### 낮은 우선순위

5. 📝 **문서화 개선** - JSDoc 주석 보강

---

## 🧪 테스트 고려사항

### 현재 상태

- 단위 테스트 파일이 보이지 않음
- 에러 케이스 테스트 필요

### 권장 사항

1. **에러 처리 테스트**: 각 에러 타입별 처리 로직 테스트
2. **Rate limit 테스트**: 재시도 로직 검증
3. **역할 조회 테스트**: 각 역할별 조회 로직 테스트

---

## 📝 결론

Phase 1 코드는 전반적으로 잘 작성되어 있으며, 타입 안전성과 보안 측면에서 우수합니다. 다만 다음과 같은 개선을 통해 코드 품질을 더욱 향상시킬 수 있습니다:

1. **코드 중복 제거**: 공통 에러 처리 로직 통합
2. **프로덕션 로깅**: 개발 환경 전용 로깅으로 변경
3. **함수 분리**: 복잡한 함수를 작은 단위로 분리
4. **타입 안전성**: 타입 단언 최소화 및 타입 가드 활용

---

## 🔗 관련 문서

- [Phase 1 실행 문서](./2025-02-04-repomix-phase1-execution.md)
- [Repomix Phase별 분석 가이드](./2025-02-04-repomix-phase-analysis-guide.md)

---

**작업 완료 시간**: 2025-02-04
