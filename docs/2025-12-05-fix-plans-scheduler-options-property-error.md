# plans.ts에서 schedulerOptions 속성 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러
```
./app/(student)/actions/plan-groups/plans.ts:149:26
Type error: Property 'enable_self_study_for_holidays' does not exist on type '{ study_days: number; review_days: number; weak_subject_focus: boolean | WeakSubjectFocus | undefined; review_scope: ReviewScope | undefined; lunch_time: TimeRange | undefined; camp_study_hours: TimeRange | undefined; self_study_hours: TimeRange | undefined; }'.
```

## 원인 분석
`schedulerOptions` 객체는 `mergedSettings`에서 일부 속성만 가져와서 만든 객체입니다. `enable_self_study_for_holidays`, `enable_self_study_for_study_days`, `designated_holiday_hours` 속성은 `mergedSettings`에 없고, `group.scheduler_options`에만 있습니다. 하지만 `schedulerOptions` 객체에서 이 속성들을 접근하려고 해서 타입 에러가 발생했습니다.

## 수정 내용

### 파일
- `app/(student)/actions/plan-groups/plans.ts`

### 변경 사항

#### 수정: group.scheduler_options에서 직접 속성 가져오기
`enable_self_study_for_holidays`, `enable_self_study_for_study_days`, `designated_holiday_hours` 속성을 `group.scheduler_options`에서 직접 가져오도록 수정했습니다.

```typescript
// 수정 전
{
  scheduler_type: "1730_timetable",
  scheduler_options: schedulerOptions || null,
  use_self_study_with_blocks: true,
  enable_self_study_for_holidays:
    schedulerOptions.enable_self_study_for_holidays === true,
  enable_self_study_for_study_days:
    schedulerOptions.enable_self_study_for_study_days === true,
  lunch_time: schedulerOptions.lunch_time,
  camp_study_hours: schedulerOptions.camp_study_hours,
  camp_self_study_hours: schedulerOptions.camp_self_study_hours,
  designated_holiday_hours: schedulerOptions.designated_holiday_hours,
  non_study_time_blocks: (group as any).non_study_time_blocks || undefined,
}

// 수정 후
{
  scheduler_type: "1730_timetable",
  scheduler_options: schedulerOptions || null,
  use_self_study_with_blocks: true,
  enable_self_study_for_holidays:
    (group.scheduler_options as any)?.enable_self_study_for_holidays === true,
  enable_self_study_for_study_days:
    (group.scheduler_options as any)?.enable_self_study_for_study_days === true,
  lunch_time: schedulerOptions.lunch_time,
  camp_study_hours: schedulerOptions.camp_study_hours,
  camp_self_study_hours: schedulerOptions.camp_self_study_hours,
  designated_holiday_hours: (group.scheduler_options as any)?.designated_holiday_hours,
  non_study_time_blocks: (group as any).non_study_time_blocks || undefined,
}
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `schedulerOptions`는 `mergedSettings`에서 일부 속성만 가져온 객체입니다.
- `enable_self_study_for_holidays`, `enable_self_study_for_study_days`, `designated_holiday_hours` 속성은 `group.scheduler_options`에만 있습니다.
- `group.scheduler_options`는 `Record<string, unknown>` 타입이므로 타입 단언(`as any`)을 사용했습니다.

