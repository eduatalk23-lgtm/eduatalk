# 지정휴일 자율학습 시간 배정 충돌 문제 수정

## 문제 상황

학습 제외일에서 휴일을 지정하면 자동으로 자율학습 시간이 배정되는데, 시간 설정 항목에서 "지정휴일 자율학습 시간 배정하기"를 활성화하고 다른 시간으로 설정하면 충돌이 발생할 수 있는 문제가 있었습니다.

### 문제점

1. **자동 배정 문제**: 지정휴일로 설정하면 `enable_self_study_for_holidays` 토글 설정과 관계없이 무조건 자율학습 시간이 배정됨
2. **토글 설정 미반영**: "지정휴일 자율학습 시간 배정하기" 토글을 꺼도 자동 배정이 계속됨
3. **설정 전달 누락**: `calculateScheduleAvailability`와 `calculateAvailableDates`에서 `enable_self_study_for_holidays` 설정이 전달되지 않음

## 수정 내용

### 1. `calculateScheduleAvailability` 수정

`enable_self_study_for_holidays`와 `enable_self_study_for_study_days` 파라미터를 추가하여 토글 설정을 전달하도록 수정했습니다.

```typescript
timeSettings?: {
  // ... 기존 설정들
  enable_self_study_for_holidays?: boolean;
  enable_self_study_for_study_days?: boolean;
};
```

### 2. `calculateAvailableDates` 수정

지정휴일 처리 로직에서 `enable_self_study_for_holidays`가 `true`일 때만 자율학습 시간을 배정하도록 수정했습니다.

**수정 전:**
```typescript
// 지정휴일 처리
if (dayType === "지정휴일") {
  slots.push({
    type: "자율학습",
    start: designatedHolidayHours.start,
    end: designatedHolidayHours.end,
  });
  return slots;
}
```

**수정 후:**
```typescript
// 지정휴일 처리
if (dayType === "지정휴일") {
  // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
  if (options.enable_self_study_for_holidays) {
    slots.push({
      type: "자율학습",
      start: designatedHolidayHours.start,
      end: designatedHolidayHours.end,
    });
  }
  return slots;
}
```

### 3. `planGroupActions.ts` 수정

플랜 생성 시 지정휴일 처리에서도 `enable_self_study_for_holidays`를 확인하도록 수정했습니다.

**수정 전:**
```typescript
// 지정휴일의 경우 배정된 학습시간을 자율학습으로 저장
if (dateMetadata.day_type === "지정휴일" && studyTimeSlots.length > 0) {
  // 자율학습 저장 로직
}
```

**수정 후:**
```typescript
// 지정휴일의 경우 배정된 학습시간을 자율학습으로 저장
// enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
const enableSelfStudyForHolidays = schedulerOptions.enable_self_study_for_holidays === true;
if (dateMetadata.day_type === "지정휴일" && studyTimeSlots.length > 0 && enableSelfStudyForHolidays) {
  // 자율학습 저장 로직
}
```

### 4. `WizardData` 타입 수정

`WizardData` 타입에 `enable_self_study_for_holidays`와 `enable_self_study_for_study_days` 필드를 추가했습니다.

```typescript
time_settings?: {
  // ... 기존 설정들
  enable_self_study_for_holidays?: boolean; // 지정휴일 자율학습 시간 배정
  enable_self_study_for_study_days?: boolean; // 학습일/복습일 자율학습 시간 배정
};
```

## 동작 방식

### 토글이 꺼져 있을 때 (`enable_self_study_for_holidays = false`)

- 지정휴일로 설정해도 자율학습 시간이 배정되지 않음
- `availableRanges`가 빈 배열로 반환됨
- 플랜 생성 시 자율학습 항목이 생성되지 않음

### 토글이 켜져 있을 때 (`enable_self_study_for_holidays = true`)

- 지정휴일에 `designated_holiday_hours`로 설정된 시간대로 자율학습 시간이 배정됨
- 사용자가 설정한 시간(예: 14:00~20:00)이 사용됨
- 기본값은 13:00~19:00

## 영향 범위

- ✅ 스케줄 가능 날짜 계산 (`calculateAvailableDates`)
- ✅ 플랜 생성 (`generatePlansFromGroup`)
- ✅ 플랜 미리보기 (`previewPlansFromGroup`)
- ✅ 스케줄 미리보기 (`Step2_5SchedulePreview`)

## 테스트 시나리오

1. **토글 OFF + 지정휴일 설정**
   - 지정휴일로 설정해도 자율학습 시간이 배정되지 않아야 함

2. **토글 ON + 기본 시간 사용**
   - 지정휴일에 13:00~19:00 시간대로 자율학습 시간이 배정되어야 함

3. **토글 ON + 사용자 지정 시간**
   - 지정휴일에 사용자가 설정한 시간대로 자율학습 시간이 배정되어야 함

4. **토글 변경 후 재계산**
   - 토글을 변경하고 스케줄을 재계산하면 변경사항이 반영되어야 함

## 관련 파일

- `app/(student)/actions/calculateScheduleAvailability.ts`
- `lib/scheduler/calculateAvailableDates.ts`
- `app/(student)/actions/planGroupActions.ts`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/new-group/_components/Step2BlocksAndExclusions.tsx`

## 날짜

- 2025-01-XX: 지정휴일 자율학습 시간 배정 충돌 문제 수정

