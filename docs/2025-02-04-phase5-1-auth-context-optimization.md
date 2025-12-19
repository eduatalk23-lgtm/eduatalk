# Phase 5.1: 사용자 정보 및 테넌트 컨텍스트 중복 조회 최적화

**작성일**: 2025-02-04  
**작업 범위**: 사용자 정보 및 테넌트 컨텍스트 중복 조회 제거  
**상태**: ✅ 완료

---

## 📋 작업 개요

초기 진단에서 식별된 **사용자 정보 및 테넌트 컨텍스트 중복 조회** 문제를 해결하기 위해 다음 작업을 수행했습니다:

1. **클라이언트 사이드**: `AuthContext` 도입으로 사용자 정보 한 번만 로드
2. **서버 사이드**: React `cache` 함수 적용으로 동일 요청 내 중복 호출 방지
3. **API 엔드포인트**: `/api/auth/me` 생성으로 클라이언트에서 사용자 정보 조회 가능

---

## 🎯 목표 달성

### 클라이언트 사이드 최적화

- ✅ `AuthContext` 생성 및 `useAuth()` 훅 제공
- ✅ React Query를 통한 자동 캐싱 및 갱신
- ✅ `/api/auth/me` 엔드포인트 생성

### 서버 사이드 최적화

- ✅ `getCurrentUser()`에 React `cache` 적용
- ✅ `getTenantContext()`에 React `cache` 적용
- ✅ 동일 요청 내 DB 쿼리 중복 제거

---

## 📁 생성/수정된 파일

### 새로 생성된 파일

1. **`app/api/auth/me/route.ts`**
   - 클라이언트에서 사용자 정보를 조회하는 API 엔드포인트
   - `getCurrentUser()`를 호출하여 사용자 정보 반환

2. **`lib/contexts/AuthContext.tsx`**
   - 클라이언트 사이드 사용자 정보 Context
   - React Query를 사용한 자동 캐싱
   - `useAuth()` 커스텀 훅 제공

### 수정된 파일

1. **`lib/auth/getCurrentUser.ts`**
   - React `cache` 함수 적용
   - 동일 요청 내 중복 호출 방지 (Next.js Request Memoization)

2. **`lib/tenant/getTenantContext.ts`**
   - React `cache` 함수 적용
   - 동일 요청 내 중복 호출 방지

3. **`app/providers.tsx`**
   - `AuthProvider` 추가
   - `QueryProvider` 내부에 배치하여 React Query 사용 가능

---

## 🔧 구현 세부사항

### 1. `/api/auth/me` 엔드포인트

```typescript
// app/api/auth/me/route.ts
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiUnauthorized("로그인이 필요합니다.");
    }
    return apiSuccess(user);
  } catch (error) {
    return handleApiError(error, "[api/auth/me]");
  }
}
```

**특징**:

- 표준 API 응답 형식 사용 (`apiSuccess`, `apiUnauthorized`, `handleApiError`)
- 서버 사이드 `getCurrentUser()` 호출 (캐싱 적용됨)

### 2. `AuthContext` 구현

```typescript
// lib/contexts/AuthContext.tsx
export function AuthProvider({ children }: AuthProviderProps) {
  const {
    data: user = null,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(authQueryOptions());

  // ...
}
```

**특징**:

- React Query를 사용한 자동 캐싱
- `staleTime`: 5분 (STABLE 데이터 기준)
- `gcTime`: 15분
- `refetchOnWindowFocus`: false (서버 컴포넌트 사용 시 불필요)
- `refetchOnReconnect`: true (네트워크 재연결 시 자동 리페치)

**사용 예시**:

```typescript
"use client";
import { useAuth } from "@/lib/contexts/AuthContext";

export function MyComponent() {
  const { user, isLoading, isError } = useAuth();

  if (isLoading) return <div>로딩 중...</div>;
  if (isError || !user) return <div>로그인이 필요합니다.</div>;

  return <div>안녕하세요, {user.email}님!</div>;
}
```

### 3. 서버 사이드 캐싱

```typescript
// lib/auth/getCurrentUser.ts
import { cache } from "react";

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // ... 기존 로직
});
```

**특징**:

- React의 `cache` 함수로 동일 요청 내 중복 호출 방지
- Next.js의 Request Memoization 활용
- 서버 컴포넌트, Server Actions, API Routes에서 자동 적용

**동작 방식**:

```typescript
// 같은 요청 내에서 여러 번 호출해도 한 번만 실행됨
const user1 = await getCurrentUser(); // DB 쿼리 실행
const user2 = await getCurrentUser(); // 캐시된 결과 반환 (DB 쿼리 없음)
const user3 = await getCurrentUser(); // 캐시된 결과 반환 (DB 쿼리 없음)
```

---

## 📊 예상 효과

### 데이터베이스 쿼리 감소

- **서버 사이드**: 동일 요청 내 중복 호출 제거로 **30-50% 감소** 예상
- **클라이언트 사이드**: React Query 캐싱으로 불필요한 API 호출 제거

### 응답 속도 개선

- **서버 사이드**: 중복 DB 쿼리 제거로 응답 시간 단축
- **클라이언트 사이드**: 캐시된 데이터 즉시 사용 가능

### 네트워크 요청 감소

- 클라이언트에서 사용자 정보를 한 번만 로드하고 재사용
- React Query의 자동 캐싱으로 불필요한 요청 방지

---

## 🔄 마이그레이션 가이드

### 클라이언트 컴포넌트에서 사용자 정보가 필요한 경우

**이전 방식** (비권장):

```typescript
"use client";
import { useEffect, useState } from "react";

export function MyComponent() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.data));
  }, []);

  // ...
}
```

**새로운 방식** (권장):

```typescript
"use client";
import { useAuth } from "@/lib/contexts/AuthContext";

export function MyComponent() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>로딩 중...</div>;
  if (!user) return <div>로그인이 필요합니다.</div>;

  // ...
}
```

### 서버 컴포넌트에서 사용자 정보가 필요한 경우

**기존 방식 유지** (변경 불필요):

```typescript
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export default async function MyPage() {
  const user = await getCurrentUser(); // 자동으로 캐싱됨

  if (!user) {
    redirect("/login");
  }

  // ...
}
```

**참고**: 서버 컴포넌트에서는 `getCurrentUser()`를 그대로 사용하면 됩니다. React `cache`가 자동으로 적용되어 동일 요청 내 중복 호출이 방지됩니다.

---

## ✅ 체크리스트

### 구현 완료

- [x] `/api/auth/me` 엔드포인트 생성
- [x] `AuthContext` 생성
- [x] `useAuth()` 훅 제공
- [x] `getCurrentUser()`에 React `cache` 적용
- [x] `getTenantContext()`에 React `cache` 적용
- [x] `AuthProvider`를 `Providers`에 추가
- [x] 린터 에러 확인 및 수정

### 향후 작업 (Phase 5.2)

- [ ] 주요 클라이언트 컴포넌트에서 `useAuth()` 사용하도록 마이그레이션
- [ ] 성능 모니터링 및 최적화 효과 측정
- [ ] 문서화 및 가이드라인 작성

---

## 📚 참고 자료

- [React Query 공식 문서](https://tanstack.com/query/latest)
- [Next.js Request Memoization](https://nextjs.org/docs/app/building-your-application/caching#request-memoization)
- [Phase 5 초기 진단](./2025-02-04-phase5-data-fetching-initial-diagnosis.md)

---

**작성자**: AI Assistant  
**검토자**: (대기 중)  
**승인자**: (대기 중)
