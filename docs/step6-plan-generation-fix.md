# Step6 플랜 생성 실패 문제 해결

## 문제 상황

관리자-학생-관리자 흐름으로 이미 모든 항목을 입력받았는데도, Step6에서 플랜 생성 시 다음과 같은 에러가 발생했습니다:

```
생성된 플랜이 없습니다. 기간, 제외일, 블록 설정을 확인해주세요.
```

## 원인 분석

### 1. dateAvailableTimeRanges에 복습일 미포함

`_generatePlansFromGroup` 함수에서 `dateAvailableTimeRanges`를 생성할 때 "학습일"만 포함하고 있었습니다:

```typescript
scheduleResult.daily_schedule.forEach((daily) => {
  if (daily.day_type === "학습일" && daily.available_time_ranges.length > 0) {
    dateAvailableTimeRanges.set(
      daily.date,
      daily.available_time_ranges.map((range) => ({
        start: range.start,
        end: range.end,
      }))
    );
  }
});
```

하지만 1730_timetable 스케줄러의 경우 복습일에도 플랜을 생성해야 합니다. `generate1730TimetablePlans` 함수에서 복습일에도 `dateAvailableTimeRanges`를 사용하고 있기 때문에, 복습일이 `dateAvailableTimeRanges`에 포함되지 않으면 플랜 생성이 실패할 수 있습니다.

### 2. 에러 메시지가 불충분

플랜 생성 실패 시 원인을 파악하기 어려운 일반적인 에러 메시지만 제공하고 있었습니다.

## 해결 방법

### 1. 복습일도 dateAvailableTimeRanges에 포함

"학습일"뿐만 아니라 "복습일"도 `dateAvailableTimeRanges`에 포함하도록 수정했습니다:

```typescript
scheduleResult.daily_schedule.forEach((daily) => {
  // 학습일과 복습일 모두 포함 (1730_timetable의 경우 복습일에도 플랜 생성 필요)
  if (
    (daily.day_type === "학습일" || daily.day_type === "복습일") &&
    daily.available_time_ranges.length > 0
  ) {
    dateAvailableTimeRanges.set(
      daily.date,
      daily.available_time_ranges.map((range) => ({
        start: range.start,
        end: range.end,
      }))
    );
  }
});
```

### 2. 디버깅 로그 및 상세 에러 메시지 추가

플랜 생성 전후로 디버깅 로그를 추가하고, 실패 시 더 자세한 정보를 제공하도록 수정했습니다:

```typescript
// 디버깅을 위한 로그 추가
console.log("[planGroupActions] 플랜 생성 시작:", {
  groupId,
  contentsCount: contents.length,
  dateAvailableTimeRangesCount: dateAvailableTimeRanges.size,
  dateTimeSlotsCount: dateTimeSlots.size,
  contentDurationMapCount: contentDurationMap.size,
  schedulerType: group.scheduler_type,
  periodStart: group.period_start,
  periodEnd: group.period_end,
  exclusionsCount: exclusions.length,
  academySchedulesCount: academySchedules.length,
});

const scheduledPlans = generatePlansFromGroup(...);

console.log("[planGroupActions] 플랜 생성 완료:", {
  scheduledPlansCount: scheduledPlans.length,
  firstPlan: scheduledPlans[0] || null,
});

if (scheduledPlans.length === 0) {
  // 더 자세한 에러 메시지 제공
  const errorDetails = [
    `콘텐츠 개수: ${contents.length}개`,
    `사용 가능한 날짜: ${dateAvailableTimeRanges.size}일`,
    `제외일: ${exclusions.length}개`,
    `학원 일정: ${academySchedules.length}개`,
  ].join(", ");

  throw new AppError(
    `생성된 플랜이 없습니다. 기간, 제외일, 블록 설정을 확인해주세요. (${errorDetails})`,
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}
```

## 수정된 파일

1. `app/(student)/actions/plan-groups/plans.ts`
   - `dateAvailableTimeRanges`에 복습일도 포함하도록 수정
   - 플랜 생성 전후 디버깅 로그 추가
   - 플랜 생성 실패 시 상세 에러 메시지 제공

## 효과

1. **복습일 플랜 생성**: 1730_timetable 스케줄러에서 복습일에도 플랜이 정상적으로 생성됩니다.
2. **디버깅 용이성**: 플랜 생성 실패 시 콘솔 로그를 통해 원인을 파악할 수 있습니다.
3. **사용자 경험 개선**: 더 자세한 에러 메시지로 문제 해결에 도움이 됩니다.

## 테스트 시나리오

1. 관리자-학생-관리자 흐름으로 캠프 플랜 그룹 생성
2. Step 3에서 학생 콘텐츠 선택
3. Step 4에서 추천 콘텐츠 선택
4. Step 6에서 최종 확인 및 조정
5. **기대 결과**: 플랜이 정상적으로 생성됨 (학습일과 복습일 모두 포함)

## 관련 이슈

- 1730_timetable 스케줄러는 학습일과 복습일을 구분하여 플랜을 생성합니다.
- 복습일에는 해당 주차의 학습 범위를 복습하는 플랜이 생성됩니다.
- `generate1730TimetablePlans` 함수는 복습일에도 `dateAvailableTimeRanges`를 사용하므로, 복습일의 `available_time_ranges`가 반드시 필요합니다.
