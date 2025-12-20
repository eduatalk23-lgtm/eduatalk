# Phase 7: Plan 페이지 최적화 완료

## 📋 작업 개요

**작업 일시**: 2025-01-XX  
**작업 범위**: Plan 페이지의 데이터 로딩 방식을 React Query 기반 Server Prefetching 패턴으로 전환

---

## ✅ 완료된 작업

### 1. 플랜 그룹 목록 조회 훅 생성

**파일**: `lib/hooks/usePlanGroups.ts`

- `planGroupsQueryOptions`: 플랜 그룹 목록 조회 쿼리 옵션 생성
- `usePlanGroups`: 플랜 그룹 목록 조회 클라이언트 훅
- 타입 안전성 보장 (`PlanGroupWithStats` 타입 사용)
- 캐시 전략: `staleTime: 1분`, `gcTime: 10분` (Dynamic Data)

**주요 특징**:
- `queryOptions` 패턴 사용으로 타입 안전성 향상
- 서버 컴포넌트에서 `prefetchQuery`로 사용 가능
- 클라이언트 컴포넌트에서 `useTypedQuery`로 사용

```typescript
// 서버 컴포넌트에서 사용
await queryClient.prefetchQuery(planGroupsQueryOptions(filters));

// 클라이언트 컴포넌트에서 사용
const { data, isLoading } = usePlanGroups({ filters });
```

---

### 2. Plan 페이지 리팩토링

**파일**: `app/(student)/plan/page.tsx`

#### 변경 사항

**Before**:
- 서버 컴포넌트에서 직접 `getPlanGroupsWithStats` 호출
- 데이터를 props로 클라이언트 컴포넌트에 전달
- 필터링, 정렬, 통계 계산을 서버에서 수행

**After**:
- `prefetchQuery` + `HydrationBoundary` 패턴 적용
- 서버에서 데이터 프리패칭만 수행
- 클라이언트 컴포넌트에서 훅을 통해 데이터 조회

#### 주요 개선점

1. **Server Prefetching**: 
   - `getQueryClient()`로 QueryClient 인스턴스 생성
   - `planGroupsQueryOptions`를 사용하여 데이터 프리패칭
   - `HydrationBoundary`로 서버 상태를 클라이언트에 전달

2. **인증 처리 개선**:
   - `getCurrentUser()` 사용 (기존 `supabase.auth.getUser()` 대신)
   - `getTenantContext()` 사용하여 테넌트 정보 조회

3. **에러 처리**:
   - Prefetch 실패 시에도 페이지 렌더링 계속 (에러 로깅만)

---

### 3. PlanGroupListContainer 클라이언트 컴포넌트 생성

**파일**: `app/(student)/plan/_components/PlanGroupListContainer.tsx`

#### 역할

- `usePlanGroups` 훅을 사용하여 데이터 조회
- 필터링, 정렬, 통계 계산을 클라이언트에서 수행
- 로딩 상태 및 빈 상태 처리

#### 주요 기능

1. **데이터 조회**:
   ```typescript
   const { data: planGroupsWithStats, isLoading } = usePlanGroups({ filters });
   ```

2. **필터링 및 정렬**:
   - 캠프 모드 플랜 제외
   - 생성일 기준 정렬 (asc/desc)

3. **통계 계산**:
   - `planCounts`: 그룹별 플랜 개수
   - `planProgressData`: 그룹별 진행 상황
   - `stats`: 전체 통계 (total, active, paused, completed)

4. **UI 렌더링**:
   - 로딩 상태: `SuspenseFallback` 표시
   - 빈 상태: `EmptyState` 컴포넌트 표시
   - 데이터 있을 때: `RescheduleRecommendations`, `PlanGroupStatsCard`, `PlanGroupList` 표시

---

## 🎯 적용된 패턴

### Today 페이지와 동일한 패턴

1. **Server Prefetching**:
   ```typescript
   const queryClient = getQueryClient();
   await queryClient.prefetchQuery(planGroupsQueryOptions(filters));
   ```

2. **HydrationBoundary**:
   ```typescript
   <HydrationBoundary state={dehydrate(queryClient)}>
     {/* 클라이언트 컴포넌트 */}
   </HydrationBoundary>
   ```

3. **클라이언트 훅 사용**:
   ```typescript
   const { data, isLoading } = usePlanGroups({ filters });
   ```

---

## 📊 성능 개선

### Before
- 서버에서 모든 데이터 처리 (필터링, 정렬, 통계 계산)
- 클라이언트에서 데이터 변경 시 서버 재요청 필요

### After
- 서버에서 데이터 프리패칭만 수행
- 클라이언트에서 React Query 캐시 활용
- 필터/정렬 변경 시 캐시된 데이터 재사용 가능
- 낙관적 업데이트 및 쿼리 무효화 지원 가능

---

## 🔄 데이터 흐름

```
1. 서버 컴포넌트 (page.tsx)
   ├─ getCurrentUser() - 사용자 정보 조회
   ├─ getTenantContext() - 테넌트 정보 조회
   ├─ planGroupFilters 구성
   └─ queryClient.prefetchQuery() - 데이터 프리패칭

2. HydrationBoundary
   └─ 서버 상태를 클라이언트에 전달

3. 클라이언트 컴포넌트 (PlanGroupListContainer)
   ├─ usePlanGroups() - 캐시된 데이터 조회
   ├─ 필터링/정렬 처리
   ├─ 통계 계산
   └─ UI 렌더링
```

---

## 🚧 향후 개선 사항

### new-group 페이지 최적화 (미완료)

**현재 상태**:
- 서버에서 데이터를 가져와 props로 전달하는 구조
- Server Actions를 사용하여 플랜 생성 처리

**개선 방향**:
1. **데이터 로딩 최적화**:
   - 마법사 단계별로 필요한 데이터를 `useSuspenseQuery`로 선언적 처리
   - 블록 세트, 콘텐츠 목록 등을 React Query로 관리

2. **Mutation 처리**:
   - `useMutation`을 사용하여 플랜 생성 처리
   - 낙관적 업데이트 적용
   - 쿼리 무효화 (`invalidateQueries`) 처리

**참고**: 현재 구조가 복잡하므로 별도 작업으로 진행 권장

---

## 📝 변경된 파일 목록

### 신규 생성
- `lib/hooks/usePlanGroups.ts` - 플랜 그룹 목록 조회 훅
- `app/(student)/plan/_components/PlanGroupListContainer.tsx` - 클라이언트 컨테이너 컴포넌트

### 수정
- `app/(student)/plan/page.tsx` - Server Prefetching 패턴 적용

---

## ✅ 검증 사항

- [x] 린트 에러 없음
- [x] TypeScript 타입 안전성 보장
- [x] Today 페이지와 동일한 패턴 적용
- [x] 서버 프리패칭 정상 동작
- [x] 클라이언트 훅 정상 동작
- [x] 필터링/정렬 정상 동작
- [x] 통계 계산 정상 동작

---

## 🎉 완료

Plan 페이지의 데이터 로딩 방식을 React Query 기반 Server Prefetching 패턴으로 성공적으로 전환했습니다. Today 페이지와 동일한 패턴을 적용하여 일관성 있는 코드베이스를 유지하고 있습니다.

