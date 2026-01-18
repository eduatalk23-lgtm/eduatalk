# 타이머 무한 루프 에러 수정

## 발생 일시
2024년 11월

## 문제 상황

### 에러 메시지
```
Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

### 발생 위치
- `lib/store/planTimerStore.ts:399` - `removeTimer` 함수
- `lib/hooks/usePlanTimer.ts:61` - `useEffect` 내에서 호출

## 원인 분석

`usePlanTimer` 훅의 `useEffect`에서 무한 업데이트 루프가 발생했습니다:

1. **의존성 배열 문제**: `useEffect`의 의존성 배열에 `timer`와 `store`가 포함되어 있었습니다.
2. **순환 참조**:
   - `removeTimer` 호출 → store 업데이트
   - store 업데이트 → `timer` 값 변경
   - `timer` 변경 → `useEffect` 재실행
   - 다시 `removeTimer` 호출 → 무한 루프

3. **상태 불일치**: `removeTimer` 호출 후 `timer`가 `undefined`가 되면, 다음 렌더에서 `!timer` 조건이 true가 되어 다시 `initPlanTimer`가 호출될 수 있었습니다.

## 해결 방법

### 변경 사항

1. **의존성 배열 최적화**:
   - `timer`와 `store`를 의존성 배열에서 제거
   - Zustand store는 안정적인 참조이므로 의존성에 포함할 필요 없음
   - 필요한 props만 의존성 배열에 포함

2. **안전한 타이머 접근**:
   - `useEffect` 내부에서 `store.timers.get(planId)`로 현재 타이머를 다시 가져옴
   - effect 실행 시점의 최신 값을 보장

3. **Early Exit 패턴**:
   - `removeTimer` 호출 후 즉시 `return`으로 effect 종료
   - 완료된 타이머는 더 이상 처리하지 않음

### 수정된 코드

```typescript
// 수정 전
useEffect(() => {
  if (isCompleted || status === "COMPLETED") {
    store.removeTimer(planId);
    return;
  }
  // ... 나머지 로직
}, [planId, status, accumulatedSeconds, startedAt, serverNow, isCompleted, timer, store]);

// 수정 후
useEffect(() => {
  if (isCompleted || status === "COMPLETED") {
    store.removeTimer(planId);
    return;
  }

  const currentTimer = store.timers.get(planId);
  // ... 나머지 로직
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [planId, status, accumulatedSeconds, startedAt, serverNow, isCompleted]);
```

## 검증 방법

1. 타이머 완료 시 정상적으로 제거되는지 확인
2. 여러 타이머가 동시에 실행될 때 충돌이 없는지 확인
3. 브라우저 콘솔에 무한 루프 에러가 없는지 확인

## 관련 파일

- `lib/hooks/usePlanTimer.ts` - 수정됨
- `lib/store/planTimerStore.ts` - 변경 없음 (정상 동작)

## 참고 사항

- Zustand store는 안정적인 참조를 유지하므로 의존성 배열에 포함할 필요가 없습니다.
- `useEffect` 내부에서 store의 최신 값을 가져오는 것이 안전합니다.
- 완료된 타이머는 즉시 제거하고 더 이상 처리하지 않아야 합니다.

