# 재시작 후 일시정지 시간 사라지는 문제 수정

## 📋 문제 상황

시작 → 일시정지 → 재시작을 하면 일시정지 시간이 사라지는 문제가 발생했습니다.

## 🔍 원인 분석

### 문제점

1. **재시작 후 `currentPausedAt`이 null이 됨**: 재시작된 플랜은 `isPaused`가 false이므로 `currentPausedAt`이 null이 됨
2. **일시정지 시간 표시 조건**: `currentPausedAt`만 확인하여 재시작 후에는 표시되지 않음

### 시나리오

1. 사용자가 일시정지 버튼 클릭 → `paused_at` 설정
2. 일시정지 타임스탬프 표시 (`currentPausedAt`)
3. 사용자가 재시작 버튼 클릭 → `resumed_at` 설정
4. `isPaused`가 false가 되어 `currentPausedAt`이 null
5. 일시정지 타임스탬프가 사라짐

## ✅ 해결 방법

### 1. TimeStats에 lastPausedAt 필드 추가

**파일**: `app/(student)/today/_utils/planGroupUtils.ts`

**변경 사항**: 재시작 후에도 마지막 일시정지 시간을 저장하는 필드 추가

```typescript
export type TimeStats = {
  // ... 기존 필드들
  currentPausedAt: string | null; // 현재 일시정지 시간 (진행 중이고 일시정지된 경우)
  lastPausedAt: string | null; // 마지막 일시정지 시간 (재시작 후에도 표시)
  lastResumedAt: string | null; // 마지막 재시작 시간
};
```

### 2. getTimeStats 함수 수정

**변경 사항**: 재시작된 플랜의 `pausedAt`도 찾아서 `lastPausedAt`에 저장

```typescript
// 현재 일시정지 시간 및 마지막 재시작 시간 조회
let currentPausedAt: string | null = null;
let lastPausedAt: string | null = null;
let lastResumedAt: string | null = null;

if (sessions) {
  // 일시정지된 플랜 찾기
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
      lastPausedAt = session.pausedAt || null;
      lastResumedAt = session.resumedAt || null;
    }
  } else if (activePlan) {
    const session = sessions.get(activePlan.id);
    if (session) {
      currentPausedAt = session.isPaused ? (session.pausedAt || null) : null;
      // 재시작된 플랜의 경우에도 마지막 일시정지 시간 표시
      if (session.pausedAt && session.resumedAt) {
        lastPausedAt = session.pausedAt;
      }
      lastResumedAt = session.resumedAt || null;
    }
  } else {
    // 활성 플랜도 없으면 재시작된 플랜 찾기
    const resumedPlan = plans.find((plan) => {
      const session = sessions.get(plan.id);
      return (
        plan.actual_start_time &&
        !plan.actual_end_time &&
        session &&
        session.pausedAt &&
        session.resumedAt &&
        !session.isPaused
      );
    });

    if (resumedPlan) {
      const session = sessions.get(resumedPlan.id);
      if (session) {
        lastPausedAt = session.pausedAt || null;
        lastResumedAt = session.resumedAt || null;
      }
    }
  }
}
```

### 3. TimeCheckSection 수정

**파일**: `app/(student)/today/_components/TimeCheckSection.tsx`

**변경 사항**: `lastPausedAt`도 확인하여 일시정지 시간 표시

```typescript
{/* 일시정지 시간 */}
{/* 현재 일시정지 중이거나 재시작 후에도 마지막 일시정지 시간 표시 */}
{(optimisticTimestamps.pause || timeStats.currentPausedAt || timeStats.lastPausedAt) && (
  <div className="flex items-center justify-between">
    <span className="text-sm text-amber-600">일시정지 시간</span>
    <span className="text-sm font-medium text-amber-900">
      {formatTimestamp(
        optimisticTimestamps.pause || timeStats.currentPausedAt || timeStats.lastPausedAt || ""
      )}
    </span>
  </div>
)}
```

## 🎯 수정 효과

### 수정 전
- 일시정지 → 일시정지 타임스탬프 표시
- 재시작 → 일시정지 타임스탬프 사라짐
- 사용자가 일시정지 시간을 확인할 수 없음

### 수정 후
- 일시정지 → 일시정지 타임스탬프 표시
- 재시작 → 일시정지 타임스탬프 유지 (마지막 일시정지 시간으로 표시)
- 재시작 시간도 함께 표시되어 일시정지-재시작 기록이 명확함

## 📌 핵심 변경 사항

1. **`lastPausedAt` 필드 추가**: 재시작 후에도 마지막 일시정지 시간 저장
2. **재시작된 플랜 찾기**: `pausedAt`과 `resumedAt`이 모두 있는 플랜 찾기
3. **일시정지 시간 표시 조건 확장**: `currentPausedAt` 또는 `lastPausedAt`이 있으면 표시

## ✅ 테스트 시나리오

1. ✅ 플랜 시작 → 시작 시간 표시
2. ✅ 일시정지 → 일시정지 시간 표시
3. ✅ 재시작 → 일시정지 시간 유지, 재시작 시간 표시
4. ✅ 다시 일시정지 → 새로운 일시정지 시간 표시
5. ✅ 다시 재시작 → 새로운 일시정지 시간 유지, 새로운 재시작 시간 표시

