# 학습시간 계산에서 현재 일시정지 상태 고려 수정

## 📋 문제 상황

일시정지 중인 플랜의 학습 시간이 정확하게 계산되지 않는 문제가 발생했습니다.

### 문제점

1. **현재 일시정지 중인 경우 미고려**: `calculateStudyTimeFromTimestamps` 함수가 `paused_duration_seconds`만 사용하여 이미 완료된 일시정지 시간만 제외하고, 현재 진행 중인 일시정지 시간은 제외하지 않음
2. **일시정지 중에도 시간 증가**: 일시정지 버튼을 누른 후에도 학습 시간이 계속 증가하는 것처럼 보임
3. **단일뷰/일일뷰 불일치**: 같은 플랜이 다른 뷰에서 다른 시간으로 표시될 수 있음

## 🔍 원인 분석

### 기존 로직

```typescript
export function calculateStudyTimeFromTimestamps(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  pausedDurationSeconds: number | null | undefined
): number {
  if (!startTime) return 0;
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const totalSeconds = Math.floor((end - start) / 1000);
  const pausedSeconds = pausedDurationSeconds || 0;
  return Math.max(0, totalSeconds - pausedSeconds);
}
```

**문제**: `paused_duration_seconds`는 이미 완료된 일시정지 시간만 포함하고, 현재 진행 중인 일시정지 시간은 포함하지 않음

### 시나리오

1. 시작 → 학습 시간 증가
2. 일시정지 → `paused_at` 저장, 하지만 `paused_duration_seconds`는 아직 업데이트 안 됨
3. 일시정지 중 → `paused_at`부터 현재까지의 시간이 학습 시간에서 제외되지 않음
4. 재시작 → `resumed_at` 저장, `paused_duration_seconds` 업데이트

## ✅ 해결 방법

### 1. calculateStudyTimeFromTimestamps 함수 수정

**파일**: `app/(student)/today/_utils/planGroupUtils.ts`

**변경 사항**: 현재 일시정지 중인 경우 추가 파라미터로 받아서 처리

```typescript
export function calculateStudyTimeFromTimestamps(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  pausedDurationSeconds: number | null | undefined,
  isCurrentlyPaused?: boolean,  // 추가
  currentPausedAt?: string | null  // 추가
): number {
  if (!startTime) return 0;

  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const totalSeconds = Math.floor((end - start) / 1000);
  
  // 이미 완료된 일시정지 시간
  let pausedSeconds = pausedDurationSeconds || 0;
  
  // 현재 일시정지 중인 경우 추가 계산
  if (isCurrentlyPaused && currentPausedAt && !endTime) {
    const pausedAt = new Date(currentPausedAt).getTime();
    const now = Date.now();
    pausedSeconds += Math.floor((now - pausedAt) / 1000);
  }

  return Math.max(0, totalSeconds - pausedSeconds);
}
```

### 2. PlanItem 컴포넌트 수정

**파일**: `app/(student)/today/_components/PlanItem.tsx`

**변경 사항**: 현재 일시정지 상태와 일시정지 시작 시간 전달

```typescript
const elapsedSeconds = useMemo(() => {
  const sessionPausedAt = plan.session ? (plan.session as any).pausedAt : null;
  return calculateStudyTimeFromTimestamps(
    plan.actual_start_time,
    plan.actual_end_time,
    plan.paused_duration_seconds,
    isPaused,
    sessionPausedAt
  );
}, [
  plan.actual_start_time,
  plan.actual_end_time,
  plan.paused_duration_seconds,
  isPaused,
  plan.session
]);
```

### 3. TimestampDisplay 컴포넌트 수정

**파일**: `app/(student)/today/_components/TimestampDisplay.tsx`

**변경 사항**: `currentPausedAt` prop 추가 및 전달

```typescript
type TimestampDisplayProps = {
  // ... 기존 props
  currentPausedAt?: string | null; // 추가
};

const displaySeconds = calculateStudyTimeFromTimestamps(
  actualStartTime,
  actualEndTime,
  pausedDurationSeconds,
  isPaused,
  currentPausedAt  // 추가
);
```

### 4. PlanTimerCard 컴포넌트 수정

**파일**: `app/(student)/today/_components/PlanTimerCard.tsx`

**변경 사항**: `currentPausedAt` prop 추가 및 전달

### 5. calculateGroupTotalStudyTime 함수 수정

**파일**: `app/(student)/today/_utils/planGroupUtils.ts`

**변경 사항**: sessions를 받아서 각 플랜의 현재 일시정지 상태 고려

```typescript
export function calculateGroupTotalStudyTime(
  planGroup: PlanGroup,
  sessions?: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>
): number {
  return planGroup.plans.reduce((sum, plan) => {
    const session = sessions?.get(plan.id);
    const isCurrentlyPaused = session?.isPaused ?? false;
    const currentPausedAt = session?.pausedAt ?? null;
    
    const studyTime = calculateStudyTimeFromTimestamps(
      plan.actual_start_time,
      plan.actual_end_time,
      plan.paused_duration_seconds,
      isCurrentlyPaused,
      currentPausedAt
    );
    
    return sum + studyTime;
  }, 0);
}
```

## 🎯 수정 효과

### 수정 전

- 일시정지 중에도 학습 시간이 계속 증가하는 것처럼 보임
- `paused_duration_seconds`만 사용하여 현재 일시정지 시간 미반영
- 단일뷰와 일일뷰에서 시간 불일치 가능

### 수정 후

- 일시정지 중에는 학습 시간이 증가하지 않음
- 현재 일시정지 중인 경우 `paused_at`부터 현재까지 시간 자동 제외
- 모든 뷰에서 일관된 시간 표시

## 📌 핵심 변경 사항

1. **함수 시그니처 확장**: `calculateStudyTimeFromTimestamps`에 `isCurrentlyPaused`, `currentPausedAt` 파라미터 추가
2. **현재 일시정지 시간 계산**: 일시정지 중이면 `paused_at`부터 현재까지 시간 추가 제외
3. **컴포넌트 업데이트**: PlanItem, TimestampDisplay, PlanTimerCard에서 일시정지 정보 전달
4. **그룹 시간 계산 개선**: `calculateGroupTotalStudyTime`에서도 현재 일시정지 상태 고려

## ✅ 테스트 시나리오

1. ✅ 시작 → 학습 시간 정상 증가
2. ✅ 일시정지 → 학습 시간 증가 멈춤
3. ✅ 일시정지 중 → 시간 변화 없음
4. ✅ 재시작 → 학습 시간 다시 증가
5. ✅ 완료 → 최종 학습 시간 정확히 표시
6. ✅ 단일뷰/일일뷰 일관성 → 같은 시간 표시

## 🔧 추가 개선 사항

- 모든 컴포넌트에서 일관된 시간 계산 로직 사용
- 타임스탬프 기반 계산으로 서버-클라이언트 시간 차이 문제 해결
- 현재 일시정지 상태를 실시간으로 반영

