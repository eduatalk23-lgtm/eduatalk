# 플랜그룹 자율학습시간 사용 가능 체크박스 저장 문제 수정

## 문제 상황

플랜그룹 생성/수정 시 "자율학습시간 사용 가능" 체크박스를 체크하고 저장해도 원상 복귀되는 문제가 있었습니다.

## 원인 분석

`planGroupActions.ts`의 여러 함수에서 `use_self_study_with_blocks` 값이 하드코딩되어 있었습니다:

1. `_updatePlanGroup` 함수 (1165번 라인)
2. `_createPlanGroup` 함수 (2504번 라인)
3. `_getScheduleResultData` 함수 (3637번 라인)

이 함수들에서 `calculateAvailableDates`를 호출할 때 항상 `use_self_study_with_blocks: true`로 하드코딩되어 있어, 사용자가 체크박스를 체크하거나 해제해도 실제 계산에는 반영되지 않았습니다.

## 수정 내용

### 1. `_updatePlanGroup` 함수 수정

```typescript
// 수정 전
{
  scheduler_type: group.scheduler_type as "1730_timetable" | "자동스케줄러",
  scheduler_options: (group as any).scheduler_options || null,
  use_self_study_with_blocks: true, // 하드코딩
}

// 수정 후
// scheduler_options에서 time_settings 추출
const schedulerOptions = (group.scheduler_options as any) || {};
const useSelfStudyWithBlocks = schedulerOptions.use_self_study_with_blocks ?? false;

{
  scheduler_type: group.scheduler_type as "1730_timetable" | "자동스케줄러",
  scheduler_options: {
    study_days: schedulerOptions.study_days,
    review_days: schedulerOptions.review_days,
  },
  lunch_time: schedulerOptions.lunch_time,
  camp_study_hours: schedulerOptions.camp_study_hours,
  camp_self_study_hours: schedulerOptions.camp_self_study_hours,
  designated_holiday_hours: schedulerOptions.designated_holiday_hours,
  use_self_study_with_blocks: useSelfStudyWithBlocks, // 저장된 값 사용
}
```

### 2. `_createPlanGroup` 함수 수정

동일한 방식으로 `scheduler_options`에서 `use_self_study_with_blocks` 값을 추출하여 사용하도록 수정했습니다.

### 3. `_getScheduleResultData` 함수 수정

동일한 방식으로 `scheduler_options`에서 `use_self_study_with_blocks` 값을 추출하여 사용하도록 수정했습니다.

## 수정된 파일

- `app/(student)/actions/planGroupActions.ts`

## 동작 방식

1. **저장 시**: `time_settings`의 `use_self_study_with_blocks` 값이 `scheduler_options`에 병합되어 저장됩니다.
2. **계산 시**: `scheduler_options`에서 `use_self_study_with_blocks` 값을 추출하여 `calculateAvailableDates` 함수에 전달합니다.
3. **기본값**: 값이 없는 경우 `false`를 기본값으로 사용합니다.

## 테스트 방법

1. 플랜그룹 생성/수정 페이지에서 1730 Timetable 선택
2. "자율학습시간 사용 가능" 체크박스 체크
3. 저장 후 다시 수정 모드로 진입
4. 체크박스가 체크된 상태로 유지되는지 확인
5. 체크박스 해제 후 저장
6. 다시 수정 모드로 진입하여 해제된 상태로 유지되는지 확인

## 관련 이슈

- 체크박스 저장은 정상적으로 작동하지만, 계산 시 하드코딩된 값이 사용되어 실제 반영되지 않았던 문제
- 이제 저장된 값이 정확히 계산에 반영됩니다

