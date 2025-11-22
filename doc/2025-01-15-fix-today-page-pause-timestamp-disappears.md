# /today 페이지 일시정지 타임스탬프 사라지는 문제 수정

## 📋 문제 상황

일시정지를 누르면 일시정지 타임스탬프가 사라지고 시작하기 버튼이 표시되는 문제가 발생했습니다.

## 🔍 원인 분석

### 문제점

1. **`getTimeStats`에서 일시정지된 플랜을 찾지 못함**: `activePlan`이 null이면 `currentPausedAt`도 null이 됨
2. **`isGroupPaused` 계산 오류**: `activePlansCount > 0` 조건 때문에 일시정지 후 false가 됨
3. **Optimistic 타임스탬프 초기화**: 서버 상태 업데이트 시 optimistic 타임스탬프가 사라짐

### 시나리오

1. 사용자가 일시정지 버튼 클릭
2. `pausePlan` 액션 실행 → `paused_at` 설정
3. `revalidatePath` 호출 → 페이지 재렌더링
4. `getActivePlan`은 일시정지되지 않은 플랜만 반환 → `activePlan`이 null
5. `getTimeStats`에서 `activePlan`이 null이면 `currentPausedAt`도 null
6. `TimeCheckSection`의 `useEffect`에서 `timeStats.currentPausedAt`이 null이 되면 optimistic 타임스탬프 제거
7. `isGroupPaused`가 false가 되어 시작하기 버튼 표시

## ✅ 해결 방법

### 1. getTimeStats 함수 수정

**파일**: `app/(student)/today/_utils/planGroupUtils.ts`

**변경 사항**: 일시정지된 플랜도 찾아서 `currentPausedAt` 계산

```typescript
// 현재 일시정지 시간 및 마지막 재시작 시간 조회
// 일시정지된 플랜도 찾아서 currentPausedAt 계산 (activePlan이 null일 수 있음)
let currentPausedAt: string | null = null;
let lastResumedAt: string | null = null;

if (sessions) {
  // 일시정지된 플랜 찾기 (activePlan이 없어도 일시정지된 플랜은 찾을 수 있음)
  const pausedPlan = plans.find((plan) => {
    const session = sessions.get(plan.id);
    return (
      plan.actual_start_time &&
      !plan.actual_end_time &&
      session &&
      session.isPaused
    );
  });

  if (pausedPlan) {
    const session = sessions.get(pausedPlan.id);
    if (session) {
      currentPausedAt = session.pausedAt || null;
      lastResumedAt = session.resumedAt || null;
    }
  } else if (activePlan) {
    // 일시정지된 플랜이 없으면 활성 플랜의 세션 정보 사용
    const session = sessions.get(activePlan.id);
    if (session) {
      currentPausedAt = session.isPaused ? (session.pausedAt || null) : null;
      lastResumedAt = session.resumedAt || null;
    }
  }
}
```

### 2. isGroupPaused 계산 로직 수정

**파일**: `app/(student)/today/_components/PlanGroupCard.tsx`

**변경 사항**: `activePlansCount > 0` 조건 제거, 일시정지된 플랜이 있으면 true

```typescript
// 일시정지된 플랜이 있으면 일시정지 상태로 간주
// (activePlansCount가 0이어도 일시정지된 플랜이 있으면 일시정지 상태)
const isGroupPaused = group.plans.some((plan) => {
  const session = sessions.get(plan.id);
  return (
    plan.actual_start_time &&
    !plan.actual_end_time &&
    session &&
    session.isPaused
  );
});
```

### 3. TimeCheckSection의 useEffect 수정

**파일**: `app/(student)/today/_components/TimeCheckSection.tsx`

**변경 사항**: 서버에 저장된 일시정지 타임스탬프가 없을 때만 optimistic 유지

```typescript
// props가 변경되면 optimistic 상태 초기화 (서버 상태와 동기화)
// 단, 일시정지 타임스탬프는 서버에 저장된 값이 없을 때만 optimistic 유지
useEffect(() => {
  setOptimisticIsPaused(null);
  setOptimisticIsActive(null);
  
  // 서버에서 props가 업데이트되면 optimistic 타임스탬프 제거
  // 단, 일시정지 타임스탬프는 서버에 저장된 값이 없을 때만 optimistic 유지
  setOptimisticTimestamps((prev) => {
    // 서버에 저장된 일시정지 타임스탬프가 있으면 optimistic 제거
    if (timeStats.currentPausedAt) {
      const { pause, ...rest } = prev;
      return rest;
    }
    // 서버에 저장된 값이 없으면 optimistic 유지 (일시정지 직후)
    return prev;
  });
}, [isPaused, isActive, timeStats.firstStartTime, timeStats.currentPausedAt, timeStats.lastResumedAt]);
```

## 🎯 수정 효과

### 수정 전
- 일시정지 버튼 클릭 → 타임스탬프 표시 → 서버 상태 업데이트 → 타임스탬프 사라짐 → 시작하기 버튼 표시
- 사용자가 혼란스러워함

### 수정 후
- 일시정지 버튼 클릭 → 타임스탬프 표시 → 서버 상태 업데이트 → 타임스탬프 유지 → 재시작 버튼 표시
- 일시정지 상태가 정확하게 표시됨

## 📌 핵심 변경 사항

1. **일시정지된 플랜도 찾기**: `getTimeStats`에서 `activePlan`이 없어도 일시정지된 플랜을 찾아서 `currentPausedAt` 계산
2. **일시정지 상태 정확히 계산**: `isGroupPaused`가 `activePlansCount`에 의존하지 않고 일시정지된 플랜이 있으면 true
3. **Optimistic 타임스탬프 유지**: 서버에 저장된 값이 없을 때만 optimistic 타임스탬프 유지

## ✅ 테스트 시나리오

1. ✅ 플랜 시작 → 일시정지 버튼 표시
2. ✅ 일시정지 → 일시정지 타임스탬프 표시, 재시작 버튼 표시
3. ✅ 재시작 → 재시작 타임스탬프 표시, 일시정지 버튼 표시
4. ✅ 여러 번 일시정지/재시작 → 타임스탬프 정확히 표시

