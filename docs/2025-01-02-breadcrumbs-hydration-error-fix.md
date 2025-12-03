# Breadcrumbs Hydration Error 수정

## 문제 상황

Next.js 16에서 Hydration 오류가 발생했습니다. 서버에서 렌더링된 HTML과 클라이언트에서 렌더링된 HTML이 일치하지 않아 발생한 문제였습니다.

### 오류 메시지

```
Hydration failed because the server rendered HTML didn't match the client.
```

### 오류 위치

- `components/layout/RoleBasedLayout.tsx:111`
- `Breadcrumbs` 컴포넌트와 관련된 부분

## 원인 분석

1. **`Breadcrumbs` 컴포넌트는 클라이언트 컴포넌트** (`"use client"`)
2. **`usePathname()` 훅 사용**: 클라이언트 사이드에서만 동작하는 Next.js 훅
3. **서버/클라이언트 렌더링 불일치**:
   - 서버에서는 pathname을 알 수 없어 다른 결과 렌더링
   - 클라이언트에서는 실제 pathname으로 다른 결과 렌더링
   - 이로 인해 서버와 클라이언트의 HTML이 불일치

## 해결 방법

`Breadcrumbs` 컴포넌트를 `Suspense`로 감싸서 클라이언트 사이드에서만 렌더링되도록 수정했습니다.

### 수정된 파일

#### 1. `components/layout/RoleBasedLayout.tsx`

```typescript
// Suspense import 추가
import { ReactNode, Suspense } from "react";

// Breadcrumbs를 Suspense로 감싸기
{showSidebar && (
  <Suspense fallback={null}>
    <Breadcrumbs role={role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role} />
  </Suspense>
)}
```

#### 2. `app/(admin)/admin/students/[id]/page.tsx`

페이지에서 직접 사용하는 `Breadcrumbs`도 동일하게 수정:

```typescript
// Suspense import 추가
import { Suspense } from "react";

// Breadcrumbs를 Suspense로 감싸기
<Suspense fallback={null}>
  <Breadcrumbs role="admin" dynamicLabels={dynamicLabels} />
</Suspense>
```

## 효과

1. **Hydration 오류 해결**: 서버에서는 `null` (fallback), 클라이언트에서는 실제 `Breadcrumbs`가 렌더링되어 일관성 유지
2. **점진적 렌더링**: 클라이언트에서만 pathname을 기반으로 Breadcrumbs 생성
3. **모든 레이아웃에 적용**: `RoleBasedLayout`을 사용하는 모든 레이아웃에 자동 적용
   - Student Layout
   - Admin Layout
   - Parent Layout
   - Superadmin Layout

## 참고 사항

### Suspense 사용 이유

- **클라이언트 전용 훅 사용**: `usePathname()`은 클라이언트에서만 동작
- **서버 렌더링 방지**: 서버에서는 pathname을 알 수 없으므로 렌더링하지 않음
- **일관된 초기 렌더링**: 서버와 클라이언트 모두 `null`로 시작하여 불일치 방지

### Fallback 처리

`fallback={null}`을 사용하여:
- 초기 로딩 시 아무것도 표시하지 않음
- Breadcrumbs가 필요한 경우에만 클라이언트에서 렌더링
- 레이아웃 시프트 최소화

## 관련 파일

- `components/layout/RoleBasedLayout.tsx`
- `components/navigation/global/Breadcrumbs.tsx`
- `app/(admin)/admin/students/[id]/page.tsx`
- `app/(student)/layout.tsx`
- `app/(admin)/layout.tsx`
- `app/(parent)/layout.tsx`
- `app/(superadmin)/layout.tsx`

## 테스트

1. 각 역할별 대시보드 접속 테스트
2. 다양한 경로에서 Breadcrumbs 정상 작동 확인
3. Hydration 오류가 발생하지 않는지 확인

