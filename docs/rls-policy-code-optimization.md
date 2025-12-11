# RLS 정책 개선 작업 코드 최적화 점검

## 📋 개요

이 문서는 RLS 정책 개선 작업과 관련된 코드 부분들을 점검하고 최적화한 내용을 기록합니다.

**작성 일자**: 2025-12-13  
**관련 파일**: 
- `app/actions/auth.ts`
- `lib/data/tenants.ts`

---

## 🔍 발견된 최적화 포인트

### 1. 코드 중복 제거

**문제**: `createStudentRecord`와 `createParentRecord` 함수가 거의 동일한 로직을 가지고 있음

**현재 코드**:
```typescript
// createStudentRecord와 createParentRecord가 유사한 구조
async function createStudentRecord(...) { /* ... */ }
async function createParentRecord(...) { /* ... */ }
```

**최적화 방안**: 공통 로직 추출 및 타입 제네릭 활용

### 2. RLS 정책 위반 에러 명시적 처리

**문제**: RLS 정책 위반 에러(`42501`)에 대한 명시적 처리가 없음

**현재 코드**:
```typescript
if (error) {
  if (error.code === "23505") { // UNIQUE만 처리
    return { success: true };
  }
  // 42501 (RLS 위반)은 일반 에러로 처리됨
}
```

**최적화 방안**: RLS 정책 위반 에러를 명시적으로 처리하고 로깅

### 3. 에러 코드 상수화

**문제**: 하드코딩된 에러 코드 문자열 사용

**현재 코드**:
```typescript
if (error.code === "23505") { // 하드코딩
if (error.code === "42501") { // 하드코딩
```

**최적화 방안**: 에러 코드 상수 정의 및 사용

### 4. 타입 안전성 개선

**문제**: `user_metadata`가 `Record<string, any>`로 되어 타입 안전성이 낮음

**현재 코드**:
```typescript
const signupRole = user.user_metadata?.signup_role as "student" | "parent" | null | undefined;
const tenantId = user.user_metadata?.tenant_id as string | null | undefined;
```

**최적화 방안**: 타입 정의 및 헬퍼 함수 생성

### 5. 로깅 개선

**문제**: 로깅 메시지가 일관성 없이 작성됨

**최적화 방안**: 구조화된 로깅 패턴 적용

---

## ✅ 최적화 적용

### 최적화 1: 에러 코드 상수 정의 ✅

**파일**: `lib/constants/databaseErrorCodes.ts` (신규 생성)

PostgreSQL 및 Supabase 데이터베이스 에러 코드를 상수로 정의하여 하드코딩 제거.

**주요 변경사항**:
- `DATABASE_ERROR_CODES.UNIQUE_VIOLATION` 사용 (기존 `"23505"` 대체)
- `DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION` 사용 (기존 `"42501"` 대체)

### 최적화 2: User Metadata 타입 정의 ✅

**파일**: `lib/types/auth.ts` (신규 생성)

회원가입 시 사용되는 user_metadata 타입을 명시적으로 정의하여 타입 안전성 향상.

**주요 변경사항**:
- `SignupMetadata` 인터페이스 정의
- `UserWithSignupMetadata` 타입 정의
- 타입 단언(`as`) 대신 타입 정의 활용

### 최적화 3: RLS 정책 위반 에러 처리 개선 ✅

**파일**: `app/actions/auth.ts`

RLS 정책 위반 에러를 명시적으로 처리하여 디버깅 용이성 향상.

**주요 변경사항**:
- `createStudentRecord` 함수에 RLS 정책 위반 에러 처리 추가
- `createParentRecord` 함수에 RLS 정책 위반 에러 처리 추가
- 명확한 에러 로그 메시지 추가

### 최적화 4: 타입 안전성 개선 ✅

**파일**: `app/actions/auth.ts`

`ensureUserRecord` 함수의 파라미터 타입을 명시적으로 정의.

**주요 변경사항**:
- `Record<string, any>` → `UserWithSignupMetadata` 타입 사용
- 타입 단언(`as`) 최소화

### 최적화 5: 코드 중복 제거 (선택사항)

현재 `createStudentRecord`와 `createParentRecord` 함수는 유사하지만, 테이블 구조와 비즈니스 로직의 차이를 고려하여 명시적으로 유지하는 것이 더 명확합니다. 

향후 공통 로직이 증가하면 제네릭 함수로 리팩토링 고려 가능.

---

## 📊 최적화 효과

### 1. 가독성 향상
- 에러 코드 상수 사용으로 의도 명확화
- 타입 정의로 타입 안전성 향상

### 2. 유지보수성 향상
- 에러 코드 변경 시 한 곳만 수정
- 타입 변경 시 컴파일 타임 에러 감지

### 3. 디버깅 향상
- RLS 정책 위반 에러 명시적 처리로 문제 파악 용이
- 구조화된 로깅으로 에러 추적 개선

---

## 🔗 관련 문서

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md)
- [RLS 정책 분석](./rls-policy-analysis.md)

---

**작성 일자**: 2025-12-13  
**최종 수정**: 2025-12-13

