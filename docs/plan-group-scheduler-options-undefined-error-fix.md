# 플랜그룹 schedulerOptions 변수 미정의 에러 수정

## 문제 상황

플랜 그룹 편집 시 `schedulerOptions is not defined` 에러가 발생했습니다.

```
⨯ Error [AppError]: 작업을 완료하는 중 오류가 발생했습니다: schedulerOptions is not defined
   at <unknown> (C:\project\.next\dev\server\chunks\ssr\_cc0fd260._.js:133:19) {
 code: 'INTERNAL_ERROR',
 statusCode: 500,
 isUserFacing: true,
 details: undefined,
 digest: '1594465601'
}
POST /plan/group/cfe8ea84-c2ff-408c-b01f-f9aa3e2980a3/edit 500 in 3.6s
```

## 원인 분석

`_generatePlansFromGroup` 함수에서 1467번 라인에서 `schedulerOptions` 변수를 사용하고 있었지만, 해당 변수가 선언되지 않았습니다.

```typescript
// 1467번 라인
const weakSubjectFocus = schedulerOptions?.weak_subject_focus === "high" || schedulerOptions?.weak_subject_focus === true;
```

주석에는 "schedulerOptions는 위에서 이미 선언되었으므로 재사용"이라고 되어 있었지만, 실제로는 선언되지 않았습니다.

## 수정 내용

### `_generatePlansFromGroup` 함수 수정 (`app/(student)/actions/planGroupActions.ts`)

`calculateAvailableDates` 호출 전에 `schedulerOptions` 변수를 선언하도록 수정했습니다.

```typescript
// 수정 전
// calculateAvailableDates 호출하여 Step 2.5 스케줄 결과 가져오기
const scheduleResult = calculateAvailableDates(
  // ...
  {
    scheduler_type: group.scheduler_type as "1730_timetable" | "자동스케줄러",
    scheduler_options: (group as any).scheduler_options || null,
    use_self_study_with_blocks: true,
  }
);

// ... 나중에 1467번 라인에서 schedulerOptions 사용
const weakSubjectFocus = schedulerOptions?.weak_subject_focus === "high" || schedulerOptions?.weak_subject_focus === true; // ❌ 에러 발생

// 수정 후
// schedulerOptions 변수 선언 (나중에 사용하기 위해)
const schedulerOptions = (group.scheduler_options as any) || {};

// calculateAvailableDates 호출하여 Step 2.5 스케줄 결과 가져오기
const scheduleResult = calculateAvailableDates(
  // ...
  {
    scheduler_type: group.scheduler_type as "1730_timetable" | "자동스케줄러",
    scheduler_options: schedulerOptions || null,
    use_self_study_with_blocks: true,
  }
);

// ... 나중에 1467번 라인에서 schedulerOptions 사용
const weakSubjectFocus = schedulerOptions?.weak_subject_focus === "high" || schedulerOptions?.weak_subject_focus === true; // ✅ 정상 동작
```

## 수정된 파일

- `app/(student)/actions/planGroupActions.ts`

## 동작 방식

1. **변수 선언**: `calculateAvailableDates` 호출 전에 `schedulerOptions` 변수를 선언하여 나중에 사용할 수 있도록 합니다.
2. **재사용**: 선언된 `schedulerOptions` 변수를 `calculateAvailableDates` 호출과 취약과목 로직에서 재사용합니다.

## 테스트 방법

1. 플랜 그룹 편집 페이지에서 플랜 생성 시도
2. `schedulerOptions is not defined` 에러가 발생하지 않는지 확인
3. 취약과목 로직이 정상적으로 동작하는지 확인

## 참고사항

- `schedulerOptions`는 `group.scheduler_options`에서 가져오며, 없을 경우 빈 객체 `{}`로 초기화됩니다.
- 이 변수는 `calculateAvailableDates` 호출과 취약과목 로직(`weak_subject_focus`)에서 사용됩니다.

