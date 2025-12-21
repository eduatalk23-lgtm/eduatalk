# 플랜 그룹 생성 시 회차 계산 오류 수정

## 문제 상황

플랜 그룹 생성 시 PlanListView에서 모든 플랜의 회차가 동일하게 표시되는 문제가 발생했습니다.

### 증상
- 플랜 그룹 생성 후 PlanListView에서 회차가 모두 1로 표시됨
- 같은 콘텐츠의 다른 날짜 플랜들도 같은 회차를 가짐

### 원인 분석

1. **plan_number 추론 로직의 문제**
   - `plan_number` 추론이 날짜별로만 처리되어, 같은 콘텐츠의 같은 범위를 가진 플랜들이 다른 날짜에 있으면 다른 `plan_number`를 받음
   - 전체 플랜 컨텍스트를 고려하지 않음

2. **회차 계산 로직의 문제**
   - `calculateContentSequence` 함수가 날짜 순서를 고려하지 않음
   - 같은 콘텐츠의 플랜들이 날짜 순서대로 회차가 증가하지 않음

3. **날짜 처리 순서 문제**
   - 날짜별로 처리할 때 날짜 순서가 보장되지 않음

## 해결 방법

### 1. 전체 플랜 컨텍스트에서 plan_number 추론

```typescript
// 전체 플랜을 날짜 순서대로 정렬하여 plan_number 추론
const sortedAllPlans = [...scheduledPlans].sort((a, b) => {
  if (a.plan_date !== b.plan_date) {
    return a.plan_date.localeCompare(b.plan_date);
  }
  return (a.block_index || 0) - (b.block_index || 0);
});

// 전체 플랜 컨텍스트에서 plan_number 추론
const planKeyToNumber = new Map<string, number>();
let nextPlanNumber = 1;

sortedAllPlans.forEach((plan) => {
  const planKey = `${plan.content_id}-${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
  if (!planKeyToNumber.has(planKey)) {
    planKeyToNumber.set(planKey, nextPlanNumber);
    nextPlanNumber++;
  }
});
```

### 2. 날짜 순서를 고려한 회차 계산

```typescript
/**
 * 콘텐츠별 회차 계산 함수 (날짜 순서 고려)
 * 같은 plan_number를 가진 플랜들은 같은 회차를 가짐
 * 날짜 순서대로 회차가 증가함
 */
function calculateContentSequence(
  contentId: string,
  planNumber: number | null,
  planDate: string  // 날짜 순서 고려를 위한 파라미터 추가
): number {
  // ... 기존 로직
  // 날짜 순서대로 회차가 증가하도록 보장
}
```

### 3. 날짜 순서대로 처리

```typescript
// 각 날짜별로 처리 (날짜 순서대로)
const sortedDates = Array.from(plansByDate.keys()).sort();
for (const date of sortedDates) {
  const datePlans = plansByDate.get(date)!;
  // ...
}
```

## 수정된 파일

- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

## 주요 변경 사항

1. **전체 플랜 컨텍스트에서 plan_number 추론**
   - 날짜별이 아닌 전체 플랜에서 `plan_number`를 추론하도록 변경
   - 같은 콘텐츠의 같은 범위를 가진 플랜들은 같은 `plan_number`를 받음

2. **날짜 순서 고려**
   - 날짜 순서대로 정렬하여 처리
   - 회차 계산 시 날짜 순서를 고려

3. **회차 계산 로직 개선**
   - `calculateContentSequence` 함수에 `planDate` 파라미터 추가
   - 날짜 순서대로 회차가 증가하도록 보장

## 테스트 방법

1. 플랜 그룹 생성
2. PlanListView에서 회차 확인
3. 같은 콘텐츠의 다른 날짜 플랜들이 올바른 회차를 가지는지 확인

## 예상 결과

- 같은 콘텐츠의 플랜들이 날짜 순서대로 회차가 증가
- 같은 `plan_number`를 가진 플랜들은 같은 회차를 가짐
- PlanListView에서 각 플랜의 회차가 올바르게 표시됨

