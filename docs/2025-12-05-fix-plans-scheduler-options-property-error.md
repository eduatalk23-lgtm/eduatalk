# plans.ts에서 schedulerOptions 속성 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러 1
```
./app/(student)/actions/plan-groups/plans.ts:149:26
Type error: Property 'enable_self_study_for_holidays' does not exist on type '{ study_days: number; review_days: number; weak_subject_focus: boolean | WeakSubjectFocus | undefined; review_scope: ReviewScope | undefined; lunch_time: TimeRange | undefined; camp_study_hours: TimeRange | undefined; self_study_hours: TimeRange | undefined; }'.
```

### 에러 2
```
./app/(student)/actions/plan-groups/plans.ts:154:47
Type error: Property 'camp_self_study_hours' does not exist on type '{ study_days: number; review_days: number; weak_subject_focus: boolean | WeakSubjectFocus | undefined; review_scope: ReviewScope | undefined; lunch_time: TimeRange | undefined; camp_study_hours: TimeRange | undefined; self_study_hours: TimeRange | undefined; }'. Did you mean 'camp_study_hours'?
```

### 에러 3
```
./app/(student)/actions/plan-groups/plans.ts:625:31
Type error: 'studentContentClient' is possibly 'null'.
```

### 에러 4
```
./app/(student)/actions/plan-groups/plans.ts:660:13
Type error: Type '{ data: { id: any; total_pages: any; master_content_id: any; }; error: null; }' is not assignable to type 'PostgrestSingleResponse<{ id: any; total_pages: any; master_content_id: any; } | null>'.
Type '{ data: { id: any; total_pages: any; master_content_id: any; }; error: null; }' is missing the following properties from type 'PostgrestResponseSuccess<{ id: any; total_pages: any; master_content_id: any; } | null>': count, status, statusText
```

## 원인 분석

### 에러 1
`schedulerOptions` 객체는 `mergedSettings`에서 일부 속성만 가져와서 만든 객체입니다. `enable_self_study_for_holidays`, `enable_self_study_for_study_days`, `designated_holiday_hours` 속성은 `mergedSettings`에 없고, `group.scheduler_options`에만 있습니다. 하지만 `schedulerOptions` 객체에서 이 속성들을 접근하려고 해서 타입 에러가 발생했습니다.

### 에러 2
`schedulerOptions` 객체에는 `self_study_hours` 속성만 있고 `camp_self_study_hours` 속성은 없습니다. `CalculateOptions` 타입에서는 `camp_self_study_hours`를 요구하므로, `self_study_hours`를 `camp_self_study_hours`로 매핑해야 합니다.

### 에러 3
`getSupabaseClientForStudent` 함수는 `SupabaseClientForStudentQuery` 타입을 반환하는데, 이 타입은 `SupabaseServerClient | SupabaseAdminClient`입니다. `SupabaseAdminClient`는 `null`을 포함할 수 있어서 TypeScript가 `studentContentClient`가 `null`일 수 있다고 판단했습니다. 실제로는 `ensureAdminClient()`가 `null`이 아닌 것을 보장하지만, 타입 시스템이 이를 인식하지 못합니다.

### 에러 4
`studentBook`과 `studentLecture` 변수에 수동으로 만든 객체(`{ data: ..., error: null }`)를 할당하려고 했지만, `PostgrestSingleResponse` 타입은 `count`, `status`, `statusText` 속성도 필요합니다. 수동으로 만든 객체는 이 속성들이 없어서 타입 에러가 발생했습니다.

## 수정 내용

### 파일
- `app/(student)/actions/plan-groups/plans.ts`

### 변경 사항

#### 수정 1: group.scheduler_options에서 직접 속성 가져오기
`enable_self_study_for_holidays`, `enable_self_study_for_study_days`, `designated_holiday_hours` 속성을 `group.scheduler_options`에서 직접 가져오도록 수정했습니다.

#### 수정 2: camp_self_study_hours를 self_study_hours로 매핑
`schedulerOptions`에는 `self_study_hours` 속성만 있으므로, 이를 `camp_self_study_hours`로 매핑했습니다.

#### 수정 3: studentContentClient null 체크 추가
`studentContentClient`가 `null`일 수 있다는 타입 에러를 해결하기 위해 null 체크를 추가했습니다. `null`인 경우 `AppError`를 던지도록 했습니다.

#### 수정 4: studentBook과 studentLecture를 다시 쿼리하도록 수정
`studentBook`과 `studentLecture` 변수에 수동으로 만든 객체를 할당하는 대신, 다시 쿼리하여 올바른 `PostgrestSingleResponse` 타입을 반환하도록 수정했습니다. 이렇게 하면 `count`, `status`, `statusText` 속성이 포함된 올바른 타입의 객체를 얻을 수 있습니다.

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
      camp_self_study_hours: schedulerOptions.self_study_hours,
      designated_holiday_hours: (group.scheduler_options as any)?.designated_holiday_hours,
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
- `schedulerOptions`에는 `self_study_hours` 속성만 있고, `CalculateOptions` 타입에서는 `camp_self_study_hours`를 요구하므로 `self_study_hours`를 `camp_self_study_hours`로 매핑했습니다.
- `getSupabaseClientForStudent` 함수는 `SupabaseClientForStudentQuery` 타입을 반환하며, 이 타입은 `SupabaseServerClient | SupabaseAdminClient`입니다.
- `SupabaseAdminClient`는 `null`을 포함할 수 있지만, `ensureAdminClient()`가 `null`이 아닌 것을 보장합니다.
- 타입 시스템이 이를 인식하지 못하므로, null 체크를 추가하여 타입 에러를 해결했습니다.
- `PostgrestSingleResponse` 타입은 `data`, `error` 외에도 `count`, `status`, `statusText` 속성을 포함합니다.
- 수동으로 만든 객체는 이 속성들이 없어서 타입 에러가 발생하므로, 다시 쿼리하여 올바른 타입의 객체를 얻도록 수정했습니다.

