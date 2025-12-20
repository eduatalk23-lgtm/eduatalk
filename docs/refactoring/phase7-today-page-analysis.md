# Phase 7: Today 페이지 데이터 소비 계층 분석 리포트

## 작업 일시

2024-12-21

## 목표

`app/(student)/today/page.tsx` 및 하위 컴포넌트의 현재 데이터 로딩 방식을 분석하고, Server Prefetching + Client Hook 구조로 전환하는 리팩토링 계획을 수립합니다.

---

## 현재 상태 분석

### 1. Server Component (`app/(student)/today/page.tsx`)

**현재 구현:**

```typescript
// 직접 getTodayPlans 호출
const todayPlansDataPromise = getTodayPlans({
  studentId: userId,
  tenantId: tenantContext?.tenantId || null,
  date: targetProgressDate,
  camp: false,
  includeProgress: false,
  narrowQueries: true,
  useCache: true,
  cacheTtlSeconds: 120,
}).catch((error) => {
  console.error("[TodayPage] todayPlans 조회 실패", error);
  return null;
});

const [todayPlansData] = await Promise.all([todayPlansDataPromise]);
```

**문제점:**

- ❌ React Query의 `prefetchQuery`를 사용하지 않음
- ❌ `HydrationBoundary`를 사용하지 않음
- ❌ 클라이언트에서 데이터를 다시 fetch할 가능성 (Waterfall)
- ❌ 에러 처리가 단순히 `null` 반환으로 처리됨

**장점:**

- ✅ Server Component에서 직접 데이터 로딩 (SSR)
- ✅ `useCache: true`로 서버 사이드 캐싱 활용
- ✅ `Suspense`를 사용하여 Statistics를 별도 처리

---

### 2. 클라이언트 컴포넌트 (`PlanViewContainer.tsx`)

**현재 구현:**

```typescript
// initialData를 props로 받아서 useState로 초기화
const [groups, setGroups] = useState<PlanGroup[]>(() => {
  if (initialData) {
    return groupPlansByPlanNumber(initialData.plans);
  }
  return [];
});

// loadData 함수에서 fetch 사용
const loadData = useCallback(
  async (date?: string, options?: { silent?: boolean }) => {
    // ... fetch 호출
    const response = await fetch(
      `/api/today/plans?date=${date}&camp=${campMode}`
    );
    const data = await response.json();
    // ...
  },
  [userId, campMode]
);
```

**문제점:**

- ❌ `fetch`를 직접 사용 (React Query 미사용)
- ❌ 로딩 상태를 `useState`로 수동 관리
- ❌ 에러 처리가 수동적
- ❌ 캐싱이 없어 동일한 데이터를 반복 요청
- ❌ `initialData`와 클라이언트 fetch 간 불일치 가능성

**장점:**

- ✅ `initialData`를 받아서 초기 렌더링 시 데이터 사용
- ✅ Realtime 업데이트를 위한 `usePlanRealtimeUpdates` 사용

---

### 3. Statistics 컴포넌트 (`TodayAchievementsAsync.tsx`)

**현재 구현:**

```typescript
// Server Component에서 직접 calculateTodayProgress 호출
export async function TodayAchievementsAsync({
  selectedDate,
}: TodayAchievementsAsyncProps) {
  const todayProgress = await calculateTodayProgress(
    user.userId,
    tenantContext?.tenantId || null,
    selectedDate
  );

  return <TodayAchievements todayProgress={todayProgress} ... />;
}
```

**문제점:**

- ❌ React Query를 사용하지 않음
- ❌ 클라이언트에서 날짜 변경 시 서버 컴포넌트 재렌더링 필요
- ❌ Suspense로 감싸져 있지만, 클라이언트 사이드 캐싱 없음

**장점:**

- ✅ Suspense를 사용하여 스트리밍 렌더링
- ✅ 서버에서 직접 계산하여 초기 로딩 빠름

---

## 리팩토링 계획

### Phase 7.1: `useTodayPlans` 훅 생성

**파일**: `lib/hooks/useTodayPlans.ts`

**구현 내용:**

```typescript
export function todayPlansQueryOptions(
  studentId: string,
  tenantId: string | null,
  date: string,
  options?: {
    camp?: boolean;
    includeProgress?: boolean;
  }
) {
  return queryOptions({
    queryKey: ["todayPlans", studentId, tenantId, date, options],
    queryFn: async () => {
      const response = await fetch(
        `/api/today/plans?date=${date}&camp=${options?.camp || false}&includeProgress=${options?.includeProgress || false}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch today plans");
      }
      return response.json() as Promise<TodayPlansResponse>;
    },
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
  });
}

export function useTodayPlans(
  studentId: string,
  tenantId: string | null,
  date: string,
  options?: {
    camp?: boolean;
    includeProgress?: boolean;
    enabled?: boolean;
  }
) {
  return useTypedQuery({
    ...todayPlansQueryOptions(studentId, tenantId, date, options),
    enabled: options?.enabled !== false && !!studentId && !!date,
  });
}
```

**장점:**

- ✅ 타입 안전성 보장
- ✅ 자동 캐싱 및 리페칭
- ✅ Server Component에서 `prefetchQuery` 사용 가능

---

### Phase 7.2: Server Component에서 Prefetching 적용

**파일**: `app/(student)/today/page.tsx`

**변경 사항:**

```typescript
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { todayPlansQueryOptions } from "@/lib/hooks/useTodayPlans";

export default async function TodayPage({ searchParams }: TodayPageProps) {
  // ... 기존 인증 및 파라미터 처리 ...

  const queryClient = getQueryClient();

  // Prefetch today plans
  await queryClient.prefetchQuery(
    todayPlansQueryOptions(
      userId,
      tenantContext?.tenantId || null,
      targetProgressDate,
      {
        camp: false,
        includeProgress: false,
      }
    )
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodayPageContextProvider
        initialProgressDate={targetProgressDate}
        initialProgress={initialProgress}
      >
        {/* ... 기존 JSX ... */}
      </TodayPageContextProvider>
    </HydrationBoundary>
  );
}
```

**장점:**

- ✅ 클라이언트에서 즉시 데이터 사용 가능 (Waterfall 방지)
- ✅ React Query 캐시와 동기화
- ✅ 초기 로딩 성능 향상

---

### Phase 7.3: 클라이언트 컴포넌트에서 React Query 사용

**파일**: `app/(student)/today/_components/PlanViewContainer.tsx`

**변경 사항:**

```typescript
import { useTodayPlans } from "@/lib/hooks/useTodayPlans";
import { useQueryClient } from "@tanstack/react-query";

export function PlanViewContainer({
  initialMode = "daily",
  initialPlanDate = null,
  userId,
  campMode = false,
}: PlanViewContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [planDate, setPlanDate] = useState<string>(
    initialPlanDate || getTodayISODate()
  );

  // React Query 사용
  const {
    data: plansData,
    isLoading,
    error,
  } = useTodayPlans(
    userId || "",
    null, // tenantId는 훅 내부에서 처리
    planDate,
    {
      camp: campMode,
      includeProgress: false,
      enabled: !!userId && !!planDate,
    }
  );

  // 날짜 변경 핸들러
  const handleDateChange = useCallback((newDate: string) => {
    setPlanDate(newDate);
    // React Query가 자동으로 새로운 데이터를 fetch
  }, []);

  // 데이터 변환
  const groups = useMemo(() => {
    if (plansData?.plans) {
      return groupPlansByPlanNumber(plansData.plans);
    }
    return [];
  }, [plansData]);

  // ... 나머지 로직 ...
}
```

**장점:**

- ✅ 자동 캐싱 및 리페칭
- ✅ 로딩 상태 자동 관리
- ✅ 에러 처리 표준화
- ✅ 날짜 변경 시 자동 데이터 갱신

---

### Phase 7.4: Statistics를 React Query로 전환 (선택사항)

**파일**: `lib/hooks/useTodayProgress.ts` (신규)

**구현 내용:**

```typescript
export function todayProgressQueryOptions(
  studentId: string,
  tenantId: string | null,
  date: string
) {
  return queryOptions({
    queryKey: ["todayProgress", studentId, tenantId, date],
    queryFn: async () => {
      const response = await fetch(`/api/today/progress?date=${date}`);
      if (!response.ok) {
        throw new Error("Failed to fetch today progress");
      }
      return response.json() as Promise<TodayProgress>;
    },
    staleTime: 1 * 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}

export function useTodayProgress(
  studentId: string,
  tenantId: string | null,
  date: string,
  options?: { enabled?: boolean }
) {
  return useTypedQuery({
    ...todayProgressQueryOptions(studentId, tenantId, date),
    enabled: options?.enabled !== false && !!studentId && !!date,
  });
}
```

**장점:**

- ✅ 클라이언트에서 날짜 변경 시 자동 갱신
- ✅ 캐싱으로 불필요한 요청 방지
- ✅ Suspense와 함께 사용 가능

---

## 우선순위

### High Priority

1. ✅ **Phase 7.1**: `useTodayPlans` 훅 생성
2. ✅ **Phase 7.2**: Server Component에서 Prefetching 적용
3. ✅ **Phase 7.3**: 클라이언트 컴포넌트에서 React Query 사용

### Medium Priority

4. ⚠️ **Phase 7.4**: Statistics를 React Query로 전환 (기존 Suspense 패턴과 충돌 가능성 있음)

---

## 예상 효과

### 성능 개선

- **초기 로딩**: Server Prefetching으로 클라이언트에서 즉시 데이터 사용 가능
- **네트워크 요청 감소**: React Query 캐싱으로 동일 데이터 반복 요청 방지
- **Waterfall 방지**: Server에서 미리 데이터를 로드하여 클라이언트 대기 시간 감소

### 개발자 경험 개선

- **타입 안전성**: TypeScript로 쿼리 결과 타입 보장
- **에러 처리 표준화**: React Query의 일관된 에러 처리
- **코드 간소화**: 수동 로딩 상태 관리 제거

### 사용자 경험 개선

- **로딩 상태 개선**: React Query의 자동 로딩 상태 관리
- **에러 피드백**: 표준화된 에러 처리로 사용자에게 명확한 피드백 제공
- **데이터 일관성**: React Query 캐시로 데이터 일관성 보장

---

## 주의사항

1. **Realtime 업데이트**: `usePlanRealtimeUpdates`와 React Query의 동시 사용 시 충돌 가능성 확인 필요
2. **날짜 변경**: 날짜 변경 시 쿼리 키가 변경되어 자동으로 새로운 데이터를 fetch하므로, 기존 `loadData` 로직 제거 필요
3. **initialData 제거**: Server Prefetching을 사용하면 `initialData` props가 불필요하므로 제거 가능
4. **에러 바운더리**: React Query의 에러를 처리하기 위한 Error Boundary 추가 고려

---

## 다음 단계

1. `lib/hooks/useTodayPlans.ts` 생성
2. `app/(student)/today/page.tsx`에 `HydrationBoundary` 적용
3. `PlanViewContainer.tsx`에서 `useTodayPlans` 사용
4. 테스트 및 성능 측정
5. 다른 페이지에도 동일한 패턴 적용
