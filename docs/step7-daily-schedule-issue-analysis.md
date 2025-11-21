# Step 7 일별 스케줄 문제 점검 결과

## 작업 일시

2025-01-22

## 문제점 요약

### 1. 지정 휴일 정보가 반영되지 않는 문제

**원인**: `_getScheduleResultData` 함수에서 제외일을 잘못된 테이블에서 조회하고 있습니다.

**현재 코드 (3998-4003번 라인)**:

```typescript
// 제외일 조회
const { data: exclusions } = await supabase
  .from("student_plan_exclusions") // ❌ 잘못된 테이블
  .select("exclusion_date, exclusion_type, reason")
  .eq("student_id", user.userId)
  .gte("exclusion_date", group.period_start || "")
  .lte("exclusion_date", group.period_end || "");
```

**문제점**:

- `student_plan_exclusions` 테이블은 존재하지 않거나 다른 용도로 사용됨
- 플랜 그룹별 제외일은 `plan_exclusions` 테이블에 `plan_group_id`로 저장됨
- `getPlanGroupWithDetails` 함수는 올바르게 `plan_exclusions`에서 조회함

**올바른 방법**:

```typescript
// 방법 1: getPlanGroupWithDetails 사용
const { exclusions } = await getPlanGroupWithDetails(
  groupId,
  user.userId,
  tenantId
);

// 방법 2: 직접 plan_exclusions에서 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("exclusion_date, exclusion_type, reason")
  .eq("plan_group_id", groupId)
  .gte("exclusion_date", group.period_start || "")
  .lte("exclusion_date", group.period_end || "");
```

### 2. Step 7에서 daily_schedule을 재계산하는 이유

**현재 로직 (3974-3990번 라인)**:

```typescript
// 저장된 dailySchedule이 있는지 확인
// 자율학습 시간 배정 옵션이 활성화되어 있으면 항상 재계산
const enableSelfStudyForHolidays =
  (group.scheduler_options as any)?.enable_self_study_for_holidays === true;
const enableSelfStudyForStudyDays =
  (group.scheduler_options as any)?.enable_self_study_for_study_days === true;
const hasSelfStudyOptions =
  enableSelfStudyForHolidays || enableSelfStudyForStudyDays;

if (
  group.daily_schedule &&
  Array.isArray(group.daily_schedule) &&
  group.daily_schedule.length > 0 &&
  !hasSelfStudyOptions
) {
  // 저장된 데이터 사용 (자율학습 시간 배정 옵션이 없을 때만)
  dailySchedule = group.daily_schedule as typeof dailySchedule;
} else {
  // 저장된 데이터가 없으면 계산
  // ...
}
```

**재계산하는 이유**:

1. **자율학습 시간 배정 옵션이 활성화된 경우**: 옵션이 변경되었을 수 있으므로 재계산하여 최신 옵션을 반영
2. **저장된 daily_schedule이 없는 경우**: 플랜 그룹 생성 시 저장되지 않았을 수 있음

**문제점**:

- Step 3에서 이미 완벽하게 계산된 `daily_schedule`이 있음에도 불구하고 재계산하고 있음
- 재계산 시 제외일을 잘못된 테이블에서 조회하여 지정 휴일 정보가 누락됨

### 3. Step 3 vs Step 7 비교

| 항목        | Step 3 (Step2_5SchedulePreview)      | Step 7 (\_getScheduleResultData)             |
| ----------- | ------------------------------------ | -------------------------------------------- |
| 데이터 소스 | WizardData의 `data.exclusions`       | DB에서 조회                                  |
| 제외일 조회 | `data.exclusions` 직접 사용          | `student_plan_exclusions` 테이블 (❌ 잘못됨) |
| 계산 함수   | `calculateScheduleAvailability`      | `calculateAvailableDates`                    |
| 결과 저장   | `WizardData.schedule_summary`에 저장 | `group.daily_schedule`에 저장 (재계산 시)    |

**Step 3의 장점**:

- WizardData에서 직접 제외일 정보를 가져오므로 정확함
- 플랜 그룹 생성 전이므로 최신 정보 사용

**Step 7의 문제점**:

- 잘못된 테이블에서 제외일 조회
- 재계산 시 제외일 정보가 누락되어 지정 휴일이 반영되지 않음

## 해결 방안

### 방안 1: 저장된 daily_schedule 우선 사용 (권장)

Step 3에서 이미 완벽하게 계산된 `daily_schedule`이 있으므로, Step 7에서는 저장된 데이터를 우선 사용하고, 자율학습 옵션이 변경된 경우에만 재계산:

```typescript
// 저장된 daily_schedule이 있으면 우선 사용
if (
  group.daily_schedule &&
  Array.isArray(group.daily_schedule) &&
  group.daily_schedule.length > 0
) {
  dailySchedule = group.daily_schedule as typeof dailySchedule;

  // 자율학습 옵션이 변경되었는지 확인 (옵션 변경 시에만 재계산)
  // 옵션 변경 감지는 scheduler_options의 변경 시간 또는 버전으로 확인 가능
} else {
  // 저장된 데이터가 없을 때만 재계산
  // 이때는 올바른 테이블에서 제외일 조회
}
```

### 방안 2: 제외일 조회 수정

재계산이 필요한 경우, 올바른 테이블에서 제외일을 조회:

```typescript
// 제외일 조회 - plan_exclusions 테이블에서 plan_group_id로 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("exclusion_date, exclusion_type, reason")
  .eq("plan_group_id", groupId)
  .gte("exclusion_date", group.period_start || "")
  .lte("exclusion_date", group.period_end || "");
```

또는 `getPlanGroupWithDetails` 사용:

```typescript
const { exclusions } = await getPlanGroupWithDetails(
  groupId,
  user.userId,
  tenantId
);
```

## 권장 사항

1. **즉시 수정**: 제외일 조회를 `plan_exclusions` 테이블로 변경
2. **장기 개선**: 저장된 `daily_schedule`을 우선 사용하고, 옵션 변경 시에만 재계산
3. **일관성 유지**: Step 3과 Step 7이 동일한 데이터 소스를 사용하도록 통일

## 참고

- `createPlanExclusions`: `plan_exclusions` 테이블에 `plan_group_id`로 저장
- `getPlanGroupWithDetails`: `plan_exclusions` 테이블에서 `plan_group_id`로 조회
- `_getScheduleResultData`: 현재 `student_plan_exclusions` 테이블에서 조회 (❌ 잘못됨)
