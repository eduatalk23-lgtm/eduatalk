# 지정휴일 자율학습 플랜 저장 로직 제거

## 작업 일자

2024-12-21

## 배경

자율학습 시간은 `type: "자율학습"`으로 생성되며, `assignPlanTimes`는 `type === "학습시간"` 슬롯만 받습니다. 따라서 자율학습 시간에는 플랜이 배치되지 않습니다. 또한 자율학습은 학습 활동이지만 구체적인 콘텐츠가 없으므로 플랜으로 저장할 필요가 없습니다. UI 표시는 `daily_schedule.time_slots`로 충분합니다.

## 문제점

1. **지정휴일 자율학습 플랜 저장 로직의 논리 오류**
   - 지정휴일에는 `type: "자율학습"` 슬롯만 생성됨
   - `studyTimeSlots`는 `type === "학습시간"`만 필터링
   - 따라서 `studyTimeSlots.length`는 0이어서 실제로 실행되지 않음
   - 불필요한 코드가 남아있음

2. **자율학습 플랜 저장의 불필요성**
   - 자율학습은 구체적인 콘텐츠가 없음 (페이지/시간 없음)
   - 학습 시간 집계에 포함되지 않음
   - UI 표시는 `time_slots`로 충분함

## 변경 사항

### 1. 지정휴일 자율학습 플랜 저장 로직 제거

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **1359-1469줄**: 지정휴일 자율학습 플랜 저장 로직 전체 제거
  - `enableSelfStudyForHolidays` 체크 및 자율학습 플랜 생성 로직 제거
  - 더미 custom content 생성 시도 제거
  - 자율학습 플랜 payload 생성 로직 제거

**영향**:
- 지정휴일의 자율학습은 `daily_schedule.time_slots`에만 저장되어 UI에 표시됨
- 플랜으로 저장되지 않음

### 2. 자율학습 플랜 저장 로직 제거

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **1420-1495줄**: 자율학습 플랜 분리 및 저장 로직 제거
  - `selfStudyPlans` 필터링 제거
  - 자율학습 플랜 저장 시도 제거
  - `regularPlans` 필터링에서 `DUMMY_SELF_STUDY_CONTENT_ID` 체크 제거

**변경 내용**:

```typescript
// 변경 전
const regularPlans = planPayloads.filter(
  (p) => p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
);
const selfStudyPlans = planPayloads.filter(
  (p) => p.content_id === DUMMY_SELF_STUDY_CONTENT_ID
);
// ... 자율학습 플랜 저장 로직

// 변경 후
// 자율학습 플랜이 생성되지 않으므로 필터링 불필요
if (planPayloads.length > 0) {
  // 모든 플랜을 일반 플랜으로 저장
  await studentContentClient.from("student_plan").insert(planPayloads);
}
```

### 3. 자율학습 관련 코드 정리

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **601-607줄**: `DUMMY_SELF_STUDY_CONTENT_ID` 기본값 설정 제거
- **905-911줄, 928-933줄**: 더미 콘텐츠 필터링에서 `DUMMY_SELF_STUDY_CONTENT_ID` 제거
- **1058-1061줄**: chapter 조회 스킵 로직에서 `DUMMY_SELF_STUDY_CONTENT_ID` 제거
- **1362-1364줄**: chapter 조회 필터링에서 `DUMMY_SELF_STUDY_CONTENT_ID` 제거
- **1527-1533줄**: 회차 계산 조회에서 `DUMMY_SELF_STUDY_CONTENT_ID` 필터링 제거

**참고**: `DUMMY_SELF_STUDY_CONTENT_ID`는 더 이상 사용되지 않으므로 import도 제거 가능하지만, 다른 곳에서 사용될 수 있으므로 확인 필요.

### 4. \_previewPlansFromGroup 함수에도 동일한 변경사항 적용

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **1920-1926줄**: `DUMMY_SELF_STUDY_CONTENT_ID` 기본값 설정 제거
- **1995-2001줄, 2018-2023줄**: 더미 콘텐츠 필터링에서 `DUMMY_SELF_STUDY_CONTENT_ID` 제거
- **2583-2621줄**: 지정휴일 자율학습 플랜 저장 로직 제거

## 유지해야 하는 부분

1. **daily_schedule.time_slots 생성 및 저장**: UI 표시용
   - 자율학습 시간은 `type: "자율학습"`으로 `time_slots`에 저장됨
   - 타임라인에서 자율학습 시간 표시에 사용됨

2. **자율학습 시간 계산 로직**: 학습 시간 집계용
   - `calculateAvailableTimeForDate`에서 자율학습 시간 계산
   - `study_hours` 계산에 포함 (`slot.type === "학습시간" || slot.type === "자율학습"`)

## 예상 효과

1. **코드 단순화**: 불필요한 자율학습 플랜 저장 로직 제거
2. **논리 일관성**: 자율학습은 플랜으로 저장하지 않음 (비학습 항목과 동일)
3. **버그 수정**: 실행되지 않는 코드 제거
4. **유지보수성 향상**: 명확한 책임 분리 (자율학습은 time_slots, 학습 플랜은 student_plan)

## 주의사항

- 자율학습 시간은 `time_slots`에 저장되어 UI에 표시됨
- 학습 시간 집계에는 포함되지만 플랜으로 저장되지 않음
- `DUMMY_SELF_STUDY_CONTENT_ID`는 더 이상 사용되지 않으므로 import 제거 검토 필요

## 검증

- [x] 지정휴일 자율학습 플랜 저장 로직 제거 완료
- [x] 자율학습 플랜 저장 로직 제거 완료
- [x] 자율학습 관련 코드 정리 완료
- [x] \_previewPlansFromGroup 함수에도 동일한 변경사항 적용 완료
- [x] 린터 에러 없음
















