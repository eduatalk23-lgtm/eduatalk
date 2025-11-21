# 플랜 그룹 자율학습시간 사용 가능 체크박스 저장 및 표시 문제 수정

## 📋 작업 개요

플랜 그룹 상세보기에서 1730 Timetable 전용 설정의 "자율학습시간 사용 가능" 체크박스의 저장 및 표시 문제를 수정했습니다.

## 🐛 발견된 문제

1. **체크박스 저장 문제**: 체크 여부가 데이터베이스에 저장되었다고 했지만, 저장 후 수정 진행 시 체크가 초기화되어 있음
2. **상세보기 표시 누락**: 플랜 그룹 상세보기에서 블록 및 제외일에 자율학습시간 사용 가능 체크 여부가 표시되지 않음

## 🔍 원인 분석

1. **저장 로직 문제**: `time_settings`가 `scheduler_options`에 병합되지 않고 별도로 저장되어 있었음
2. **불러오기 로직 문제**: 저장 시 `time_settings`를 `scheduler_options`에 병합하지 않아 불러올 때 복원되지 않음
3. **타입 정의 누락**: `PlanGroupCreationData` 타입에 `time_settings` 필드가 없어 타입 안전성이 부족함

## ✅ 수정 내용

### 1. 타입 정의 추가 (`lib/types/plan.ts`)

```typescript
/**
 * 시간 설정
 */
export type TimeSettings = {
  lunch_time?: { start: string; end: string };
  camp_study_hours?: { start: string; end: string };
  camp_self_study_hours?: { start: string; end: string };
  designated_holiday_hours?: { start: string; end: string };
  use_self_study_with_blocks?: boolean;
};

/**
 * 플랜 그룹 생성 데이터
 */
export type PlanGroupCreationData = {
  // ... 기존 필드들
  time_settings?: TimeSettings; // time_settings는 scheduler_options에 병합되어 저장됨
  // ...
};
```

### 2. 저장 로직 수정 (`app/(student)/actions/planGroupActions.ts`)

#### `_createPlanGroup` 함수 수정
- `time_settings`를 `scheduler_options`에 병합하여 저장하도록 수정

```typescript
// time_settings를 scheduler_options에 병합
const mergedSchedulerOptions = data.scheduler_options || {};
if (data.time_settings) {
  Object.assign(mergedSchedulerOptions, data.time_settings);
}

const groupResult = await createPlanGroup({
  // ... 기존 필드들
  scheduler_options: Object.keys(mergedSchedulerOptions).length > 0 ? mergedSchedulerOptions : null,
  // ...
});
```

#### `_savePlanGroupDraft` 함수 수정
- `time_settings`를 `scheduler_options`에 병합하여 저장하도록 수정

```typescript
// time_settings를 scheduler_options에 병합
const mergedSchedulerOptions = data.scheduler_options || {};
if (data.time_settings) {
  Object.assign(mergedSchedulerOptions, data.time_settings);
}

const groupResult = await createPlanGroup({
  // ... 기존 필드들
  scheduler_options: Object.keys(mergedSchedulerOptions).length > 0 ? mergedSchedulerOptions : null,
  // ...
});
```

#### `_updatePlanGroupDraft` 함수 수정
- `time_settings`를 `scheduler_options`에 병합하여 업데이트하도록 수정

```typescript
// time_settings를 scheduler_options에 병합
let mergedSchedulerOptions = data.scheduler_options || {};
if (data.time_settings) {
  mergedSchedulerOptions = { ...mergedSchedulerOptions, ...data.time_settings };
}

if (data.name !== undefined || data.plan_purpose !== undefined || data.scheduler_type !== undefined || data.scheduler_options !== undefined || data.time_settings !== undefined) {
  await updatePlanGroup(groupId, user.userId, {
    // ... 기존 필드들
    scheduler_options: Object.keys(mergedSchedulerOptions).length > 0 ? mergedSchedulerOptions : null,
    // ...
  });
}
```

### 3. 상세보기 표시 추가 (`app/(student)/plan/group/[id]/_components/Step2_5DetailView.tsx`)

플랜 그룹 상세보기에 1730 Timetable 전용 설정 표시 추가:

```typescript
// scheduler_options에서 time_settings 추출
const schedulerOptions = (group.scheduler_options as any) || {};
const timeSettings = {
  lunch_time: schedulerOptions.lunch_time,
  camp_study_hours: schedulerOptions.camp_study_hours,
  camp_self_study_hours: schedulerOptions.camp_self_study_hours,
  designated_holiday_hours: schedulerOptions.designated_holiday_hours,
  use_self_study_with_blocks: schedulerOptions.use_self_study_with_blocks,
};

// UI에 표시
{group.scheduler_type === "1730_timetable" && (
  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
    <h3 className="mb-2 text-sm font-semibold text-gray-900">1730 Timetable 전용 설정</h3>
    <div className="space-y-2 text-sm text-gray-700">
      {timeSettings.use_self_study_with_blocks !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-medium">자율학습시간 사용 가능:</span>
          <span className={timeSettings.use_self_study_with_blocks ? "text-green-600" : "text-gray-500"}>
            {timeSettings.use_self_study_with_blocks ? "✓ 사용 가능" : "✗ 사용 안 함"}
          </span>
        </div>
      )}
    </div>
  </div>
)}
```

## ✅ 검증 방법

1. **저장 테스트**:
   - 플랜 그룹 생성 시 "자율학습시간 사용 가능" 체크박스를 체크하고 저장
   - 플랜 그룹 수정 모드로 들어가서 체크 상태가 올바르게 복원되는지 확인

2. **표시 테스트**:
   - 플랜 그룹 상세보기에서 1730 Timetable을 사용하는 플랜 그룹 확인
   - 블록 및 제외일 섹션에 "자율학습시간 사용 가능" 체크 여부가 표시되는지 확인

## 🎯 결과

1. **저장 문제 해결**: 체크박스 상태가 정상적으로 저장되고 수정 모드에서 올바르게 복원됨
2. **표시 문제 해결**: 플랜 그룹 상세보기에 자율학습시간 사용 가능 체크 여부가 표시됨
3. **타입 안전성 향상**: `PlanGroupCreationData` 타입에 `time_settings` 필드 추가

## 📝 참고사항

- `time_settings`는 데이터베이스에 직접 저장되지 않고 `scheduler_options`에 병합되어 저장됨
- 불러올 때는 `scheduler_options`에서 `time_settings` 필드를 추출하여 사용
- 1730 Timetable이 아닌 스케줄러 타입에서는 해당 설정이 표시되지 않음

