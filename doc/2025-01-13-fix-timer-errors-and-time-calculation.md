# 작업 일지: 타이머 에러 수정 및 시간 계산 로직 개선

## 날짜
2025-01-13

## 문제 상황
1. 타이머 시작, 일시정지, 재개, 완료 시 에러 발생
2. 총 학습, 순수 학습, 일시정지 계산 수치 점검 필요

## 원인 분석

### 1. resumed_at 조회 누락 에러
- `completePlan` 함수에서 활성 세션 조회 시 `resumed_at`을 select하지 않았는데, line 262에서 `activeSession.resumed_at`을 확인하고 있었습니다.
- `resumePlan` 함수에서도 활성 세션 조회 시 `resumed_at`을 select하지 않았는데, line 562에서 `activeSession.resumed_at`을 확인하고 있었습니다.

### 2. 총 학습 시간 계산 문제
- 기존 로직: `timeStats.totalDuration + elapsedSeconds`
- 문제점: `elapsedSeconds`는 순수 학습 시간(일시정지 제외)이므로, 총 학습 시간을 계산하려면 일시정지 시간도 포함해야 합니다.
- 하지만 진행 중인 세션의 일시정지 시간이 `timeStats.pausedDuration`에 포함되어 있을 수도 있고 아닐 수도 있어서 정확하지 않았습니다.

### 3. 순수 학습 시간 계산
- 현재 로직은 올바르게 작동하고 있습니다.
- `timeStats.pureStudyTime + (진행 중이고 일시정지 중이 아니면 elapsedSeconds)`로 계산됩니다.

### 4. 일시정지 시간 계산
- 현재 일시정지 중인 시간(`currentPauseSeconds`)을 계산하는 로직을 추가했습니다.

## 해결 방법

### 1. resumed_at 조회 추가
`completePlan`과 `resumePlan` 함수에서 활성 세션 조회 시 `resumed_at`을 select에 추가했습니다:

```typescript
// completePlan
.select("id, paused_duration_seconds, paused_at, resumed_at")

// resumePlan
.select("id, paused_at, paused_duration_seconds, resumed_at")
```

### 2. 총 학습 시간 계산 로직 개선
진행 중인 세션의 총 시간을 직접 계산하도록 수정했습니다:

```typescript
const currentTotalSeconds = (() => {
  if (isCompleted) {
    return timeStats.totalDuration;
  }
  if (!timeStats.isActive || !hasStartTime) {
    return timeStats.totalDuration;
  }
  // 진행 중인 세션의 총 시간 계산
  try {
    const start = new Date(normalizedStartTime!).getTime();
    const now = Date.now();
    const activeTotalSeconds = Math.floor((now - start) / 1000);
    return timeStats.totalDuration + activeTotalSeconds;
  } catch {
    return timeStats.totalDuration;
  }
})();
```

### 3. 현재 일시정지 중인 시간 계산 추가
진행 중이고 일시정지된 경우 현재 일시정지 중인 시간을 계산하는 로직을 추가했습니다:

```typescript
const currentPauseSeconds = (() => {
  if (!isActiveState || !isPausedState || !timeStats.currentPausedAt) {
    return 0;
  }
  try {
    const pausedAt = new Date(timeStats.currentPausedAt).getTime();
    const now = Date.now();
    return Math.floor((now - pausedAt) / 1000);
  } catch {
    return 0;
  }
})();
```

## 수정된 파일
- `app/(student)/today/actions/todayActions.ts`
  - `completePlan`: `resumed_at` 조회 추가
  - `resumePlan`: `resumed_at` 조회 추가
- `app/(student)/today/_components/TimeCheckSection.tsx`
  - 총 학습 시간 계산 로직 개선
  - 현재 일시정지 중인 시간 계산 추가

## 테스트 항목
- [ ] 타이머 시작 시 에러 없이 동작
- [ ] 타이머 일시정지 시 에러 없이 동작
- [ ] 타이머 재개 시 에러 없이 동작
- [ ] 타이머 완료 시 에러 없이 동작
- [ ] 총 학습 시간이 정확하게 표시되는지 확인
- [ ] 순수 학습 시간이 정확하게 표시되는지 확인
- [ ] 일시정지 시간이 정확하게 계산되는지 확인

