# useEffect 의존성 배열 크기 변경 오류 수정

## 📋 문제 상황

`TimeCheckSection` 컴포넌트에서 `useEffect`의 의존성 배열 크기가 변경되는 오류가 발생했습니다.

```
The final argument passed to useEffect changed size between renders. 
The order and size of this array must remain constant.

Previous: [false, true, 2025-11-22T14:04:38.129+00:00, , 2025-11-22T14:04:56.084+00:00]
Incoming: [false, true, 2025-11-22T14:04:38.129+00:00, , 2025-11-22T14:04:48.217+00:00, 2025-11-22T14:04:56.084+00:00]
```

## 🔍 원인 분석

### 문제점

1. **의존성 배열에 `null` 값 포함**: `timeStats.lastPausedAt`이 `null`에서 문자열로 변경되면서 배열 크기가 변경됨
2. **React의 의존성 배열 검증**: React는 의존성 배열의 크기가 렌더링 간에 일정해야 함
3. **`null` 값 처리**: `null` 값이 배열에서 제거되거나 추가되면서 크기가 변경됨

### 시나리오

1. 초기 렌더링: `timeStats.lastPausedAt`이 `null`
2. 일시정지 후: `timeStats.lastPausedAt`이 타임스탬프 문자열로 변경
3. 의존성 배열 크기 변경: `null`에서 값으로 변경되면서 배열 크기가 변경됨

## ✅ 해결 방법

### TimeCheckSection의 useEffect 수정

**파일**: `app/(student)/today/_components/TimeCheckSection.tsx`

**변경 사항**: 의존성 배열의 값들을 안정화하여 `null`을 명시적으로 처리

```typescript
// 의존성 배열의 값들을 안정화하여 배열 크기가 변경되지 않도록 함
const firstStartTime = timeStats.firstStartTime ?? null;
const currentPausedAt = timeStats.currentPausedAt ?? null;
const lastPausedAt = timeStats.lastPausedAt ?? null;
const lastResumedAt = timeStats.lastResumedAt ?? null;

useEffect(() => {
  setOptimisticIsPaused(null);
  setOptimisticIsActive(null);
  
  // 서버에서 props가 업데이트되면 optimistic 타임스탬프 제거
  // 단, 일시정지 타임스탬프는 서버에 저장된 값이 없을 때만 optimistic 유지
  setOptimisticTimestamps((prev) => {
    // 서버에 저장된 일시정지 타임스탬프가 있으면 optimistic 제거
    if (currentPausedAt || lastPausedAt) {
      const { pause, ...rest } = prev;
      return rest;
    }
    // 서버에 저장된 값이 없으면 optimistic 유지 (일시정지 직후)
    return prev;
  });
}, [isPaused, isActive, firstStartTime, currentPausedAt, lastPausedAt, lastResumedAt]);
```

## 🎯 수정 효과

### 수정 전
- `timeStats.lastPausedAt`이 `null`에서 값으로 변경되면 의존성 배열 크기 변경
- React 오류 발생

### 수정 후
- 모든 의존성 값을 `null`로 정규화하여 배열 크기 일정 유지
- React 오류 해결

## 📌 핵심 변경 사항

1. **의존성 값 안정화**: `timeStats`의 값들을 `?? null`로 정규화
2. **배열 크기 일정 유지**: 항상 같은 수의 의존성을 유지
3. **명시적 null 처리**: `null` 값을 명시적으로 처리하여 예측 가능한 동작 보장

## ✅ 테스트 시나리오

1. ✅ 초기 렌더링 → 오류 없음
2. ✅ 일시정지 → `lastPausedAt` 값 변경, 오류 없음
3. ✅ 재시작 → `lastResumedAt` 값 변경, 오류 없음
4. ✅ 여러 번 일시정지/재시작 → 의존성 배열 크기 일정 유지

