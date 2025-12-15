# 네비게이션 시스템 Critical 개선 작업

**작성 일자**: 2025-01-XX  
**작업 범위**: 쿼리 파라미터 처리, 동적 라우트 매칭, 타입 안전성 개선 및 코드 중복 제거

---

## 작업 개요

네비게이션 시스템의 높은 우선순위 문제점들을 해결하여 경로 매칭 정확도와 타입 안전성을 향상시켰습니다.

## 주요 개선 사항

### 1. 쿼리 파라미터 처리 개선

**문제점**:
- `isPathActive` 함수가 쿼리 파라미터를 고려하지 않음
- `/blocks?tab=blocks`와 `/blocks?tab=exclusions`를 구분하지 못함
- Next.js의 `usePathname()`은 쿼리 파라미터를 제외하므로 별도 처리 필요

**해결 방법**:
- `NavigationItem` 타입에 `queryParams?: Record<string, string>` 필드 추가
- `isPathActive` 함수에 `searchParams` 및 `itemQueryParams` 파라미터 추가
- 쿼리 파라미터 비교 로직 구현 (`matchQueryParams` 함수)
- `href`에서 쿼리 파라미터를 분리하는 `parseHref` 함수 추가

**수정된 파일**:
- `components/navigation/global/types.ts`: `queryParams` 필드 추가
- `components/navigation/global/resolveActiveCategory.ts`: 쿼리 파라미터 처리 로직 추가
- `components/navigation/global/CategoryNav.tsx`: `searchParams` 전달
- `components/navigation/global/configs/studentCategories.ts`: 쿼리 파라미터 정의 추가

**예시**:
```typescript
{
  id: "blocks-sets",
  label: "블록 세트",
  href: "/blocks?tab=blocks",
  queryParams: { tab: "blocks" },
}
```

### 2. 동적 라우트 매칭 로직 수정

**문제점**:
- `pathname.includes("/[")` 조건이 항상 false (실제 pathname에는 `[`가 없음)
- 불필요한 조건들이 복잡하게 얽혀있음
- 동적 라우트 매칭이 불완전함

**해결 방법**:
- 불필요한 조건 제거 (`pathname.includes("/[")`, `item.href.includes("[")` 등)
- 세그먼트 기반 매칭으로 단순화
- UUID/ID 패턴 매칭 개선

**수정된 파일**:
- `components/navigation/global/resolveActiveCategory.ts`: `isItemActive` 함수의 동적 라우트 매칭 로직 개선

**개선된 로직**:
```typescript
// 세그먼트 기반 매칭
const itemSegments = itemPathname.split("/").filter(Boolean);
const pathSegments = pathname.split("/").filter(Boolean);

// 부모 경로 매칭 확인
if (pathSegments.length > itemSegments.length) {
  // 세그먼트 일치 확인 및 UUID/ID 패턴 검사
}
```

### 3. 타입 안전성 개선

**문제점**:
- `NavigationRole` 타입에 `consultant`가 없음
- `RoleBasedLayout`에서 `consultant`를 사용하지만 네비게이션에서는 `admin`으로 매핑
- 데이터베이스 `admin_users.role`에는 `consultant`가 존재함

**해결 방법**:
- `NavigationRole` 타입에 `"consultant"` 추가
- `categoryConfig`에 `consultant: adminCategories` 매핑 추가
- `mapRoleForNavigation` 유틸리티 함수 생성
- `getBreadcrumbChain` 및 `getSegmentLabel`에서 `consultant` 역할 처리

**수정된 파일**:
- `components/navigation/global/types.ts`: `NavigationRole`에 `consultant` 추가
- `lib/navigation/utils.ts`: `mapRoleForNavigation` 함수 추가
- `components/layout/RoleBasedLayout.tsx`: 하드코딩된 매핑을 유틸리티 함수로 교체
- `components/navigation/global/categoryConfig.ts`: `consultant` 카테고리 매핑 추가
- `components/navigation/global/resolveActiveCategory.ts`: `consultant` 역할 처리 추가

**새로운 유틸리티 함수**:
```typescript
export function mapRoleForNavigation(role: NavigationRole | "consultant"): NavigationRole {
  if (role === "consultant") {
    return "admin";
  }
  return role;
}
```

### 4. 코드 중복 제거 및 최적화

**문제점**:
- `CategoryNav`에서 캠프 모드 처리 로직이 `useMemo`와 `useState` 초기화에서 중복
- 동일한 계산을 두 번 수행

**해결 방법**:
- 캠프 모드 활성 카테고리 계산을 공통 함수로 추출 (`getActiveCategoryWithCampMode`)

**수정된 파일**:
- `lib/navigation/utils.ts`: `getActiveCategoryWithCampMode` 함수 추가
- `components/navigation/global/CategoryNav.tsx`: 중복 로직 제거

**새로운 유틸리티 함수**:
```typescript
export function getActiveCategoryWithCampMode(
  pathname: string,
  role: NavigationRole,
  searchParams: URLSearchParams | null,
  categories: NavigationCategory[],
  campMode: boolean
): ActiveCategoryInfo | null
```

## 변경된 파일 목록

### 수정된 파일

1. `components/navigation/global/types.ts`
   - `NavigationRole`에 `"consultant"` 추가
   - `NavigationItem`에 `queryParams?: Record<string, string>` 필드 추가

2. `components/navigation/global/resolveActiveCategory.ts`
   - `parseHref` 함수 추가 (href에서 쿼리 파라미터 분리)
   - `matchQueryParams` 함수 추가 (쿼리 파라미터 비교)
   - `isPathActive` 함수에 쿼리 파라미터 처리 추가
   - `isItemActive` 함수에 `searchParams` 파라미터 추가 및 동적 라우트 매칭 개선
   - `findActiveItemInCategory` 함수에 `searchParams` 파라미터 추가
   - `resolveActiveCategory` 함수에 `searchParams` 파라미터 추가
   - `isCategoryPath` 함수에 `searchParams` 파라미터 추가
   - `getBreadcrumbChain`에서 `consultant` 역할 처리 추가
   - `getSegmentLabel`에서 `consultant` 역할 처리 추가

3. `components/navigation/global/CategoryNav.tsx`
   - `resolveActiveCategory` 호출 시 `searchParams` 전달
   - `isItemActive` 호출 시 `searchParams` 전달
   - `isCategoryPath` 호출 시 `searchParams` 전달
   - 캠프 모드 로직을 `getActiveCategoryWithCampMode` 함수로 교체

4. `components/navigation/global/configs/studentCategories.ts`
   - 쿼리 파라미터가 있는 항목에 `queryParams` 필드 추가
   - `/blocks?tab=blocks` → `queryParams: { tab: "blocks" }`
   - `/blocks?tab=exclusions` → `queryParams: { tab: "exclusions" }`
   - `/blocks?tab=academy` → `queryParams: { tab: "academy" }`
   - `/scores/input?tab=internal` → `queryParams: { tab: "internal" }`
   - `/scores/input?tab=mock` → `queryParams: { tab: "mock" }`
   - `/reports?period=weekly` → `queryParams: { period: "weekly" }`
   - `/reports?period=monthly` → `queryParams: { period: "monthly" }`

5. `lib/navigation/utils.ts`
   - `mapRoleForNavigation` 함수 추가
   - `getActiveCategoryWithCampMode` 함수 추가
   - 필요한 타입 import 추가

6. `components/layout/RoleBasedLayout.tsx`
   - 하드코딩된 역할 매핑을 `mapRoleForNavigation` 함수로 교체 (3곳)

7. `components/navigation/global/categoryConfig.ts`
   - `categoryConfig`에 `consultant: adminCategories` 매핑 추가

## 개선 효과

### 기능 개선

- ✅ 쿼리 파라미터 기반 탭 네비게이션 정확도 향상
  - `/blocks?tab=blocks`와 `/blocks?tab=exclusions`를 정확히 구분
  - `/scores/input?tab=internal`과 `/scores/input?tab=mock`를 정확히 구분

- ✅ 동적 라우트 활성 상태 표시 정확도 향상
  - `/contents/books/[id]` 형태의 동적 라우트 정확히 매칭
  - 세그먼트 기반 매칭으로 더 정확한 판단

- ✅ 타입 안전성 향상
  - `consultant` 역할이 타입 시스템에 포함됨
  - 런타임 오류 가능성 감소

### 코드 품질

- ✅ 코드 중복 제거 (캠프 모드 로직 통합)
- ✅ 역할 매핑 로직 명확화 (유틸리티 함수로 분리)
- ✅ 타입 안전성 향상 (명확한 타입 정의)

### 유지보수성

- ✅ 역할별 독립적 수정 가능
- ✅ 쿼리 파라미터 처리 로직 중앙화
- ✅ 명확한 함수 시그니처

## 테스트 시나리오

### 쿼리 파라미터 매칭

1. `/blocks?tab=blocks` → "블록 세트" 활성화 ✅
2. `/blocks?tab=exclusions` → "학습 제외 일정" 활성화 ✅
3. `/blocks?tab=academy` → "학원 일정" 활성화 ✅
4. `/scores/input?tab=internal` → "내신 성적 입력" 활성화 ✅
5. `/scores/input?tab=mock` → "모의고사 성적 입력" 활성화 ✅
6. `/reports?period=weekly` → "주간 리포트" 활성화 ✅
7. `/reports?period=monthly` → "월간 리포트" 활성화 ✅

### 동적 라우트 매칭

1. `/contents/books/[id]` → "콘텐츠 관리" 카테고리 활성화 ✅
2. `/plan/group/[id]` → "플랜 관리" 카테고리 활성화 ✅
3. `/contents/lectures/[id]` → "콘텐츠 관리" 카테고리 활성화 ✅

### 역할 매핑

1. `consultant` 역할 사용자 → `admin` 카테고리 표시 ✅
2. `consultant` 역할 사용자 → Breadcrumbs에서 "관리자 홈" 표시 ✅

## 검증 결과

- ✅ TypeScript 컴파일 오류 없음
- ✅ Linter 오류 없음
- ✅ 모든 import 경로 정상 작동
- ✅ 하위 호환성 유지

## 기술적 세부사항

### 쿼리 파라미터 처리 로직

```typescript
// href에서 쿼리 파라미터 분리
function parseHref(href: string): { pathname: string; queryParams: Record<string, string> }

// 쿼리 파라미터 비교
function matchQueryParams(
  currentParams: URLSearchParams | null,
  itemQueryParams?: Record<string, string>
): boolean

// 경로 매칭 (쿼리 파라미터 포함)
function isPathActive(
  pathname: string,
  href: string,
  exactMatch: boolean = false,
  searchParams?: URLSearchParams | null,
  itemQueryParams?: Record<string, string>
): boolean
```

### 동적 라우트 매칭 로직

```typescript
// 세그먼트 기반 매칭
const itemSegments = itemPathname.split("/").filter(Boolean);
const pathSegments = pathname.split("/").filter(Boolean);

// 부모 경로 매칭 및 UUID/ID 패턴 검사
if (pathSegments.length > itemSegments.length) {
  // 세그먼트 일치 확인
  // 마지막 세그먼트가 UUID/ID 형태인지 확인
}
```

### 역할 매핑

```typescript
// consultant → admin 매핑
export function mapRoleForNavigation(role: NavigationRole | "consultant"): NavigationRole {
  if (role === "consultant") {
    return "admin";
  }
  return role;
}
```

---

**작업 완료**: 모든 Phase 완료 ✅

