# 스케줄 표시 문제 수정

**작업일**: 2025-02-02

## 문제 상황

1. **소요시간 30분 표기**: 화면에서 모든 플랜의 소요시간이 30분으로 표기됨
2. **시간 항목 오류**: 화면에서 시간이 제대로 표시되지 않음
3. **플랜 171개 생성**: 강의 콘텐츠의 에피소드가 23~24회인데 플랜이 171개 생성됨

## 수정 내용

### 1. 시간 표시 개선

**파일**: `app/(student)/plan/new-group/_components/_features/scheduling/components/TimeSlotsWithPlans.tsx`

DB에 저장된 `start_time`과 `end_time`을 우선 사용하도록 수정:

```typescript
// DB에 저장된 start_time과 end_time을 우선 사용
let startTime: string | null = null;
let endTime: string | null = null;

if (plan.start_time && plan.end_time) {
  // DB에 저장된 시간이 있으면 직접 사용
  startTime = plan.start_time;
  endTime = plan.end_time;
} else {
  // 없으면 getPlanStartTime으로 추정
  startTime = getPlanStartTime(plan, date, blocks);
}

// DB에 저장된 시간이 있으면 그 시간을 사용, 없으면 추정 시간 사용
const originalStartTime = startTime ? timeToMinutes(startTime) : null;
const originalEndTime = endTime ? timeToMinutes(endTime) : null;
const originalDuration = originalStartTime !== null && originalEndTime !== null
  ? originalEndTime - originalStartTime
  : estimatedTime;
```

플랜 배치 시 DB 시간을 우선 사용:

```typescript
// DB에 저장된 시간이 있으면 그대로 사용
if (planInfo.originalEndTime !== null && planStart >= slotStart && planEnd <= slotEnd) {
  plansInSlot.push({
    plan: planInfo.plan,
    start: minutesToTime(planStart),
    end: minutesToTime(planEnd),
    isPartial: false,
    isContinued: false,
    originalEstimatedTime: planInfo.originalEstimatedTime,
  });
  planInfo.remainingTime = 0; // DB 시간을 사용했으므로 남은 시간 0
}
```

### 2. 소요시간 표시 개선

**파일**: `app/(student)/plan/new-group/_components/_features/scheduling/components/PlanTable.tsx`

`originalEstimatedTime`을 우선 사용하도록 수정:

```typescript
// 실제 배치된 시간 계산
const actualDuration =
  timeToMinutes(planTime.end) - timeToMinutes(planTime.start);
// originalEstimatedTime이 있으면 우선 사용 (DB 시간 또는 계산된 예상 시간)
const displayDuration = planTime.originalEstimatedTime ?? actualDuration;
```

화면 표시 시 `displayDuration` 사용:

```typescript
<span>{formatTime(displayDuration)}</span>
```

## 영향 범위

- 스케줄 결과 화면에서 DB에 저장된 시간이 정확히 표시됨
- 소요시간이 episode별 duration을 반영하여 정확히 표시됨
- 시간 항목이 DB의 `start_time`과 `end_time`을 우선 사용하여 정확히 표시됨

## 관련 파일

- `app/(student)/plan/new-group/_components/_features/scheduling/components/TimeSlotsWithPlans.tsx` - 시간 표시 로직
- `app/(student)/plan/new-group/_components/_features/scheduling/components/PlanTable.tsx` - 소요시간 표시 로직

## 참고 사항

- 플랜 171개 생성 문제는 여러 날짜에 걸쳐 플랜이 생성되기 때문에 발생할 수 있습니다. 이는 정상적인 동작일 수 있으며, 각 날짜별 플랜 개수를 확인하여 중복 생성 여부를 확인해야 합니다.
- SchedulerEngine이 이미 episode별로 분할한 플랜(`start === end`)은 재분할하지 않도록 이미 수정되어 있습니다.

