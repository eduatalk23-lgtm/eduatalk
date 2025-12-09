# 비학습 항목 플랜 저장 로직 제거 및 개선

## 작업 일자
2024-12-21

## 배경

비학습 항목(학원일정, 점심시간, 이동시간) 플랜 저장은 불필요하며, 학습 콘텐츠 배치는 이미 학습시간 슬롯에만 이루어지므로 비학습 시간대에 배치되지 않습니다. 또한 플랜 그룹은 독립적으로 관리되어야 하므로 다른 플랜 그룹의 플랜을 고려할 필요가 없습니다.

## 변경 사항

### 1. 비학습 항목 플랜 저장 로직 제거

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **1371-1515줄**: 비학습 항목 저장 로직 전체 제거
  - `nonStudySlots` 필터링 및 순회 로직 제거
  - 비학습 항목 플랜 payload 생성 로직 제거
  - 더미 콘텐츠 생성 시도 제거 (1396-1428줄)

**영향**:
- 비학습 항목은 `daily_schedule.time_slots`에만 저장되어 UI에 표시됨
- 학습 플랜은 `assignPlanTimes`를 통해 학습시간 슬롯에만 배치됨

### 2. 더미 플랜 저장 시도 제거

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **1547-1637줄**: 더미 UUID 플랜 저장 로직 수정
  - `dummyPlans` 필터링을 `selfStudyPlans`로 변경
  - `DUMMY_NON_LEARNING_CONTENT_ID` 관련 필터링 제거
  - `DUMMY_SELF_STUDY_CONTENT_ID`만 유지 (자율학습은 유지)

**변경 내용**:
```typescript
// 변경 전
const regularPlans = planPayloads.filter(
  (p) =>
    p.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
    p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
);
const dummyPlans = planPayloads.filter(
  (p) =>
    p.content_id === DUMMY_NON_LEARNING_CONTENT_ID ||
    p.content_id === DUMMY_SELF_STUDY_CONTENT_ID
);

// 변경 후
const regularPlans = planPayloads.filter(
  (p) => p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
);
const selfStudyPlans = planPayloads.filter(
  (p) => p.content_id === DUMMY_SELF_STUDY_CONTENT_ID
);
```

### 3. 기존 플랜 조회 시 plan_group_id 필터링 추가

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **1137-1145줄**: 기존 플랜 조회 쿼리에 `plan_group_id` 필터링 추가
  - 같은 플랜 그룹 내의 기존 플랜만 확인
  - 다른 플랜 그룹의 플랜은 block_index 조정에 영향 없음

**변경 내용**:
```typescript
// 변경 전
const { data: existingPlansForDates, error: existingPlansError } =
  await supabase
    .from("student_plan")
    .select("plan_date, block_index")
    .eq("student_id", studentId)
    .in("plan_date", planDates);

// 변경 후
const { data: existingPlansForDates, error: existingPlansError } =
  await supabase
    .from("student_plan")
    .select("plan_date, block_index")
    .eq("student_id", studentId)
    .eq("plan_group_id", groupId) // ✅ 같은 플랜 그룹만 조회
    .in("plan_date", planDates);
```

### 4. 더미 콘텐츠 관련 코드 정리

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **601-607줄**: `DUMMY_NON_LEARNING_CONTENT_ID` 관련 기본값 설정 제거
- **913-916줄, 939-942줄**: 더미 콘텐츠 필터링 로직에서 `DUMMY_NON_LEARNING_CONTENT_ID` 제거
- **1070-1071줄**: chapter 조회 스킵 로직에서 `DUMMY_NON_LEARNING_CONTENT_ID` 제거
- **1490-1491줄**: chapter 조회 필터링에서 `DUMMY_NON_LEARNING_CONTENT_ID` 제거
- **1675줄**: 회차 계산 조회에서 `DUMMY_NON_LEARNING_CONTENT_ID` 필터링 제거

**참고**: 자율학습(`DUMMY_SELF_STUDY_CONTENT_ID`) 관련 로직은 유지합니다. 지정휴일의 자율학습은 실제 학습시간 슬롯에 배치되므로 플랜으로 저장하는 것이 적절합니다.

### 5. _previewPlansFromGroup 함수에도 동일한 변경사항 적용

**파일**: `app/(student)/actions/plan-groups/plans.ts`

- **2081-2087줄**: `DUMMY_NON_LEARNING_CONTENT_ID` 관련 기본값 설정 제거
- **2157-2161줄**: 더미 콘텐츠 필터링 로직에서 `DUMMY_NON_LEARNING_CONTENT_ID` 제거
- **2183-2187줄**: 에러 처리 로직에서 `DUMMY_NON_LEARNING_CONTENT_ID` 제거
- **2754-2836줄**: 비학습 항목 저장 로직 전체 제거

## 유지해야 하는 부분

1. **daily_schedule.time_slots 생성 및 저장**: UI 표시용
2. **학습시간 슬롯 필터링 로직** (1221-1233줄): `assignPlanTimes`에 전달
3. **assignPlanTimes 함수**: 학습시간 슬롯에만 플랜 배치
4. **자율학습 관련 로직** (1517-1627줄): 지정휴일 자율학습은 유지

## 예상 효과

1. **코드 단순화**: 불필요한 더미 콘텐츠 생성 및 플랜 저장 로직 제거
2. **플랜 그룹 독립성 보장**: 다른 플랜 그룹과의 block_index 충돌 방지 불필요
3. **데이터베이스 부하 감소**: 더미 플랜 저장 시도 제거
4. **유지보수성 향상**: 명확한 책임 분리 (비학습 항목은 time_slots, 학습 플랜은 student_plan)

## 주의사항

- 자율학습 관련 로직은 유지 (지정휴일 자율학습은 실제 학습시간 슬롯에 배치)
- `DUMMY_NON_LEARNING_CONTENT_ID`는 import만 남아있고 실제로 사용되지 않음 (다른 파일에서 사용될 수 있어 유지)

## 검증

- [x] 비학습 항목 플랜 저장 로직 제거 완료
- [x] 더미 플랜 저장 시도 제거 완료
- [x] 기존 플랜 조회 시 plan_group_id 필터링 추가 완료
- [x] 더미 콘텐츠 관련 코드 정리 완료
- [x] _previewPlansFromGroup 함수에도 동일한 변경사항 적용 완료
- [x] 린터 에러 없음

