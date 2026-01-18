# Phase 2 TanStack Query 타입 안전성 강화 작업 완료 보고

**작업 일자**: 2025-02-04  
**작업 범위**: `queryOptions` 패턴 적용으로 타입 안전성 향상

## 개요

Phase 2 계획에 따라 TanStack Query의 `queryOptions` 패턴을 적용하여 타입 안전성을 향상시키는 작업을 진행했습니다.

## 완료된 작업

### 1. `useActivePlan` 훅 개선

**파일**: `lib/hooks/useActivePlan.ts`

**변경 사항**:
- `queryOptions` 패턴 적용
- `activePlanQueryOptions` 함수 생성
- 명시적 반환 타입 정의 (`ActivePlan`)
- `queryClient.getQueryData()`에서 타입 추론 자동 지원

**수정 전**:
```typescript
export function useActivePlan({ studentId, planDate, enabled = true }) {
  return useQuery({
    queryKey: ["activePlan", studentId, planDate],
    queryFn: async () => {
      // ...
    },
    enabled,
    staleTime: CACHE_STALE_TIME_REALTIME,
    refetchInterval: 1000 * 30,
  });
}
```

**수정 후**:
```typescript
function activePlanQueryOptions(studentId: string, planDate: string) {
  return queryOptions({
    queryKey: ["activePlan", studentId, planDate] as const,
    queryFn: async (): Promise<ActivePlan> => {
      // ...
    },
    staleTime: CACHE_STALE_TIME_REALTIME,
    refetchInterval: 1000 * 30,
  });
}

export function useActivePlan({ studentId, planDate, enabled = true }) {
  return useQuery({
    ...activePlanQueryOptions(studentId, planDate),
    enabled,
  });
}
```

**효과**:
- 타입 안전성 향상: `data`가 자동으로 `ActivePlan | undefined`로 추론됨
- `queryClient.getQueryData(["activePlan", studentId, planDate])`에서 타입 추론 자동
- 코드 재사용성 향상: `prefetchQuery` 등에서도 사용 가능

### 2. `useActivePlanDetails` 훅 개선

**파일**: `lib/hooks/useActivePlanDetails.ts`

**변경 사항**:
- `queryOptions` 패턴 적용
- `activePlanDetailsQueryOptions` 함수 생성
- 명시적 반환 타입 정의 (`ActivePlanDetails | null`)
- `queryClient.getQueryData()`에서 타입 추론 자동 지원

**수정 전**:
```typescript
export function useActivePlanDetails({ planId, enabled = true }) {
  return useQuery({
    queryKey: ["activePlanDetails", planId],
    queryFn: async (): Promise<ActivePlanDetails | null> => {
      // ...
    },
    enabled: enabled && !!planId,
    staleTime: CACHE_STALE_TIME_REALTIME,
    refetchInterval: 1000 * 30,
  });
}
```

**수정 후**:
```typescript
function activePlanDetailsQueryOptions(planId: string) {
  return queryOptions({
    queryKey: ["activePlanDetails", planId] as const,
    queryFn: async (): Promise<ActivePlanDetails | null> => {
      // ...
    },
    staleTime: CACHE_STALE_TIME_REALTIME,
    refetchInterval: 1000 * 30,
  });
}

export function useActivePlanDetails({ planId, enabled = true }) {
  return useQuery({
    ...activePlanDetailsQueryOptions(planId || ""),
    enabled: enabled && !!planId,
  });
}
```

**효과**:
- 타입 안전성 향상: `data`가 자동으로 `ActivePlanDetails | null | undefined`로 추론됨
- `queryClient.getQueryData(["activePlanDetails", planId])`에서 타입 추론 자동
- 코드 재사용성 향상: `prefetchQuery` 등에서도 사용 가능

## 기존 패턴 (참고)

`usePlans` 훅은 이미 `queryOptions` 패턴을 사용하고 있었습니다:

```typescript
function plansQueryOptions(studentId: string, tenantId: string | null, planDate: string) {
  return queryOptions({
    queryKey: ["plans", studentId, planDate] as const,
    queryFn: async (): Promise<Plan[]> => {
      return await getPlansForStudent({ studentId, tenantId, planDate });
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
  });
}

export function usePlans({ studentId, tenantId, planDate, enabled = true }) {
  return useQuery({
    ...plansQueryOptions(studentId, tenantId, planDate),
    enabled,
  });
}
```

## 개선 효과

1. **타입 안전성 향상**
   - 컴파일 타임에 타입 체크 가능
   - IDE 자동완성 및 타입 힌트 지원
   - 런타임 에러 방지

2. **코드 재사용성 향상**
   - `queryOptions` 함수를 `prefetchQuery` 등에서도 사용 가능
   - 서버 컴포넌트에서도 동일한 쿼리 옵션 사용 가능

3. **일관성 향상**
   - 모든 React Query 훅에서 동일한 패턴 사용
   - 코드 가독성 향상

4. **타입 추론 자동화**
   - `queryClient.getQueryData()`에서 타입 추론 자동
   - 타입 단언(`as`) 불필요

## 다음 단계

다른 훅들도 점진적으로 `queryOptions` 패턴으로 전환할 예정입니다:

- `useBlockSet`
- `usePlanPeriod`
- 기타 React Query를 사용하는 훅들

## 참고 사항

- TanStack Query v5의 `queryOptions` 패턴은 2025년 모범 사례입니다
- `queryOptions`를 사용하면 타입 안전성과 코드 재사용성이 크게 향상됩니다
- `queryKey`는 `as const`로 선언하여 타입 추론을 최대화합니다

