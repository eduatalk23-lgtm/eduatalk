# 작업 일지: 타이머 초기화 시 시간 정보가 사라지지 않는 문제 수정

## 날짜
2025-01-13

## 문제 상황
타이머 초기화 시 시간 정보(시작 시간, 일시정지 시간, 종료 시간)가 사라지지 않고 그대로 표시되었습니다.

## 원인 분석

### 1. 타이머 로그 상태 업데이트 지연
- `TimeCheckSection`에서 타이머 로그를 조회하는 `useEffect`가 `timeStats`의 일부 필드만 의존성으로 가지고 있었습니다.
- 초기화 후 `timeStats`가 변경되어도 모든 필드가 변경되지 않으면 `useEffect`가 다시 실행되지 않을 수 있습니다.

### 2. 초기화 후 즉시 UI 업데이트되지 않음
- 초기화 버튼 클릭 시 `onReset` 핸들러가 실행되고 `router.refresh()`가 호출되지만, 클라이언트 컴포넌트의 `timerLogs` 상태는 즉시 업데이트되지 않습니다.
- `timerLogs.length > 0`이면 타이머 로그를 표시하고, 아니면 `timeStats`를 표시하는데, 초기화 후 `timerLogs`가 빈 배열이 되어도 `timeStats`가 아직 업데이트되지 않아 이전 값이 표시될 수 있습니다.

### 3. PlanGroupCard의 timerLogs 상태 미갱신
- `PlanGroupCard`에서도 `timerLogs`를 관리하고 있지만, 초기화 시 빈 배열로 설정하지 않았습니다.

## 해결 방법

### 1. 초기화 버튼 클릭 시 즉시 timerLogs 빈 배열로 설정
`TimeCheckSection`의 초기화 버튼 클릭 핸들러에서 `onReset` 호출 전에 즉시 `timerLogs`를 빈 배열로 설정하도록 수정했습니다:

```typescript
onClick={async () => {
  if (onReset) {
    // 즉시 타이머 로그를 빈 배열로 설정하여 UI 업데이트
    setTimerLogs([]);
    await onReset();
    // 초기화 후 서버 상태 반영을 위해 약간의 딜레이 후 타이머 로그 다시 조회
    setTimeout(async () => {
      const result = await getTimerLogsByPlanNumber(planNumber, planDate);
      if (result.success && result.logs) {
        setTimerLogs(result.logs);
      } else {
        setTimerLogs([]);
      }
    }, 300);
  }
}}
```

### 2. timeStats의 모든 필드를 useEffect 의존성에 추가
`timeStats`의 모든 필드를 `useEffect` 의존성 배열에 추가하여, 초기화 후 `timeStats`가 변경되면 타이머 로그를 다시 조회하도록 수정했습니다:

```typescript
useEffect(() => {
  const loadTimerLogs = async () => {
    const result = await getTimerLogsByPlanNumber(planNumber, planDate);
    if (result.success && result.logs) {
      setTimerLogs(result.logs);
    } else {
      setTimerLogs([]);
    }
  };
  loadTimerLogs();
}, [
  planNumber,
  planDate,
  timeStats.firstStartTime,
  timeStats.lastEndTime,
  timeStats.totalDuration,
  timeStats.pausedDuration,
  timeStats.pauseCount,
  timeStats.isActive,
  timeStats.isCompleted,
]);
```

### 3. PlanGroupCard에서도 초기화 시 timerLogs 빈 배열로 설정
`PlanGroupCard`의 `handleResetTimer` 함수에서도 초기화 성공 시 즉시 `timerLogs`를 빈 배열로 설정하도록 수정했습니다:

```typescript
const handleResetTimer = async () => {
  setIsLoading(true);
  try {
    const result = await resetPlanTimer(group.planNumber, planDate);
    if (result.success) {
      // 즉시 타이머 로그를 빈 배열로 설정하여 UI 업데이트
      setTimerLogs([]);
      // 서버 상태 반영을 위해 페이지 새로고침
      startTransition(() => {
        router.refresh();
      });
    }
  } finally {
    setIsLoading(false);
  }
};
```

## 수정된 파일
1. `app/(student)/today/_components/TimeCheckSection.tsx`
   - 초기화 버튼 클릭 시 즉시 `timerLogs`를 빈 배열로 설정
   - `timeStats`의 모든 필드를 `useEffect` 의존성에 추가
   - 초기화 후 재조회 딜레이를 300ms로 증가

2. `app/(student)/today/_components/PlanGroupCard.tsx`
   - 초기화 성공 시 즉시 `timerLogs`를 빈 배열로 설정
   - `startTransition`을 사용하여 페이지 새로고침

## 동작 방식
1. 사용자가 타이머 초기화 버튼 클릭
2. 즉시 `timerLogs`를 빈 배열로 설정하여 시간 정보 영역이 비워짐
3. `onReset` 핸들러 실행 (서버에서 데이터 삭제)
4. `router.refresh()` 호출 (서버 컴포넌트 재렌더링)
5. 300ms 후 타이머 로그 다시 조회
6. `timeStats`가 변경되면 자동으로 타이머 로그 다시 조회

## 커밋
- 커밋 해시: (최신 커밋)
- 커밋 메시지: `fix: 타이머 초기화 시 시간 정보가 사라지지 않는 문제 수정`

