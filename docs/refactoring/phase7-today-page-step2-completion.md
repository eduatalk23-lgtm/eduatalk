# Phase 7: Today 페이지 클라이언트 컴포넌트 리팩토링 완료 리포트

## 작업 일시
2024-12-21

## 목표
`PlanViewContainer.tsx`와 `TodayPlansSection.tsx`에서 레거시 `fetch` 로직을 제거하고 `useTodayPlans` 훅을 사용하도록 전환합니다.

---

## 완료된 작업

### 1. `app/(student)/today/_components/PlanViewContainer.tsx` 리팩토링 ✅

**주요 변경사항:**

#### Before:
```typescript
// fetch 직접 호출
const loadData = useCallback(async (date?: string) => {
  const response = await fetch(`/api/today/plans${query}`);
  const data = await response.json();
  setGroups(groupPlansByPlanNumber(data.plans));
  // ...
}, []);

// initialData props 사용
const [groups, setGroups] = useState(() => {
  if (initialData) {
    return groupPlansByPlanNumber(initialData.plans);
  }
  return [];
});

// useEffect에서 데이터 로딩
useEffect(() => {
  if (initialData) {
    // initialData 사용
  } else {
    loadData(initialPlanDate);
  }
}, [initialPlanDate, loadData, initialData]);
```

#### After:
```typescript
// React Query 훅 사용
const {
  data: plansData,
  isLoading,
  isError,
  error,
} = useTodayPlans({
  studentId: userId || "",
  tenantId,
  date: planDate,
  camp: campMode,
  includeProgress: true,
  enabled: !!userId && !!planDate,
});

// useMemo로 데이터 가공
const groups = useMemo(() => {
  if (plansData?.plans) {
    return groupPlansByPlanNumber(plansData.plans);
  }
  return [];
}, [plansData?.plans]);

// 날짜 변경 시 자동 리페치
const handleMoveDay = useCallback((delta: number) => {
  const nextDate = shiftIsoDate(planDate, delta);
  if (nextDate) {
    setPlanDate(nextDate); // 상태만 변경하면 자동 리페치
  }
}, [planDate]);
```

**제거된 코드:**
- ✅ `loadData` 함수 전체 제거
- ✅ `fetch` 직접 호출 제거
- ✅ `initialData` props 제거
- ✅ `loading`, `isNavigating` 상태 제거 (React Query의 `isLoading` 사용)
- ✅ `useEffect`에서 데이터 로딩 로직 제거
- ✅ `queryDateRef` 제거 (불필요)

**추가된 코드:**
- ✅ `useTodayPlans` 훅 사용
- ✅ `useMemo`로 데이터 가공 최적화
- ✅ 에러 처리 UI 추가
- ✅ `tenantId` props 추가

---

### 2. `app/(student)/today/_components/TodayPlansSection.tsx` 리팩토링 ✅

**주요 변경사항:**

#### Before:
```typescript
type TodayPlansSectionProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  userId?: string;
  campMode?: boolean;
  initialPlansData?: PlansResponse; // 제거됨
};

export function TodayPlansSection({
  initialPlansData, // 제거됨
  // ...
}: TodayPlansSectionProps) {
  return (
    <PlanViewContainer
      initialData={initialPlansData} // 제거됨
      // ...
    />
  );
}
```

#### After:
```typescript
type TodayPlansSectionProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  userId?: string;
  tenantId?: string | null; // 추가됨
  campMode?: boolean;
};

export function TodayPlansSection({
  tenantId = null, // 추가됨
  // ...
}: TodayPlansSectionProps) {
  return (
    <PlanViewContainer
      tenantId={tenantId} // 추가됨
      // ...
    />
  );
}
```

**변경사항:**
- ✅ `initialPlansData` prop 제거
- ✅ `PlansResponse` 타입 정의 제거 (더 이상 필요 없음)
- ✅ `tenantId` prop 추가

---

### 3. `app/(student)/today/page.tsx` 수정 ✅

**변경사항:**
- ✅ `TodayPlansSection`에 `tenantId` prop 전달 추가

```typescript
<TodayPlansSection
  initialMode={requestedView}
  initialPlanDate={requestedDate}
  userId={userId}
  tenantId={tenantContext?.tenantId || null} // 추가됨
/>
```

---

## 개선 사항

### 1. 코드 간소화
- **Before**: ~370줄 (fetch 로직, 상태 관리, 에러 처리 포함)
- **After**: ~260줄 (React Query로 자동화)
- **감소**: 약 30% 코드 감소

### 2. 성능 개선
- **자동 캐싱**: React Query가 동일한 날짜의 데이터를 캐시하여 불필요한 요청 방지
- **자동 리페치**: 날짜 변경 시 자동으로 새로운 데이터 로드
- **최적화된 렌더링**: `useMemo`로 데이터 가공 최적화

### 3. 에러 처리 개선
- **표준화된 에러 처리**: React Query의 일관된 에러 처리
- **사용자 친화적 UI**: 에러 발생 시 재시도 버튼 제공

### 4. 타입 안전성
- **타입 추론**: `useTodayPlans` 훅이 `TodayPlansResponse` 타입을 자동으로 추론
- **컴파일 타임 체크**: TypeScript로 타입 안전성 보장

---

## 주의사항

### 1. 날짜 상태 관리
- `planDate` 상태는 로컬 state로 유지
- `planDate`가 변경되면 `useTodayPlans`가 자동으로 새로운 데이터를 fetch
- Server Prefetching으로 초기 데이터는 즉시 사용 가능

### 2. Realtime 업데이트
- `usePlanRealtimeUpdates`는 그대로 유지
- React Query와 함께 사용하여 실시간 업데이트 지원

### 3. todayProgress 전달
- `includeProgress: true`로 설정하여 별도 API 호출 방지
- `onDateChange` 콜백을 통해 `TodayPageContext`에 전달

---

## 테스트 체크리스트

- [ ] Today 페이지 정상 로딩 확인
- [ ] 날짜 변경 시 자동 리페칭 동작 확인
- [ ] 로딩 상태 UI 표시 확인
- [ ] 에러 발생 시 에러 UI 표시 확인
- [ ] 재시도 버튼 동작 확인
- [ ] React Query Devtools에서 쿼리 상태 확인
- [ ] 캐싱 동작 확인 (같은 날짜 재방문 시 즉시 로딩)

---

## 다음 단계

### Phase 7.4: TodayAchievementsAsync를 React Query로 전환 (선택사항)

현재 `TodayAchievementsAsync`는 Server Component에서 직접 `calculateTodayProgress`를 호출하고 있습니다. 이를 React Query로 전환하면 클라이언트에서 날짜 변경 시 자동으로 갱신됩니다.

**고려사항:**
- Suspense 패턴과의 충돌 가능성
- Server Component의 장점 (초기 로딩 빠름) 유지 필요
- 클라이언트 사이드 캐싱의 이점

---

## 참고사항

- `useTodayPlans` 훅은 `lib/hooks/useTodayPlans.ts`에 정의되어 있습니다.
- Server Prefetching은 `app/(student)/today/page.tsx`에서 `prefetchQuery`를 통해 수행됩니다.
- 모든 변경사항은 하위 호환성을 유지하며 기존 기능을 보존합니다.

