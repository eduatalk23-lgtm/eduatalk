# 콘텐츠별 회차 계산 로직 개선

## 작업 일시
2025-12-21 19:42:24

## 문제점

플랜 그룹 생성 시 회차 계산에 문제가 있었습니다:

1. **전역 회차만 사용**: `globalSequence`를 사용하여 모든 플랜에 순차적으로 회차를 부여하고 있었음
2. **콘텐츠별 회차 미구현**: 콘텐츠별로 독립적인 회차 계산이 되지 않음
3. **쪼개진 플랜 처리 미흡**: episode 분할로 인해 여러 플랜으로 나뉘어도 같은 회차를 가져야 하는데, 각각 다른 회차를 받음
4. **같은 plan_number 처리 미흡**: 같은 `plan_number`를 가진 플랜들이 같은 회차를 가지지 않음

### 예시 문제 상황

```
콘텐츠 A (수학 교재):
- 플랜 1: 1-9p → 회차 1 (전역 회차 1)
- 플랜 2: 10-18p → 회차 2 (전역 회차 2)

콘텐츠 B (영어 교재):
- 플랜 1: 1-10p → 회차 3 (전역 회차 3) ❌ 잘못됨! 콘텐츠 B의 1회차여야 함
- 플랜 2: 11-20p → 회차 4 (전역 회차 4) ❌ 잘못됨! 콘텐츠 B의 2회차여야 함
```

episode 분할 시:
```
콘텐츠 A 강의 (2-5강):
- 분할 전: 2-5강 → 회차 1
- 분할 후:
  - 2강 → 회차 1 ✅
  - 3강 → 회차 2 ❌ (같은 회차여야 함)
  - 4강 → 회차 3 ❌ (같은 회차여야 함)
  - 5강 → 회차 4 ❌ (같은 회차여야 함)
```

## 해결 방법

### 1. 콘텐츠별 회차 계산 함수 추가

`generatePlansRefactored.ts`에 `calculateContentSequence` 함수를 추가하여 콘텐츠별로 독립적인 회차를 계산하도록 했습니다.

```typescript
function calculateContentSequence(
  contentId: string,
  planNumber: number | null
): number {
  // 콘텐츠별 회차 맵 초기화
  if (!contentSequenceMap.has(contentId)) {
    contentSequenceMap.set(contentId, {
      lastSequence: 0,
      seenPlanNumbers: new Set(),
      planNumberToSequence: new Map(),
    });
  }

  const contentSeq = contentSequenceMap.get(contentId)!;

  // 같은 plan_number를 가진 플랜이 이미 있으면 그 회차를 재사용
  if (planNumber !== null && contentSeq.planNumberToSequence.has(planNumber)) {
    return contentSeq.planNumberToSequence.get(planNumber)!;
  }

  // plan_number가 null이거나 새로운 plan_number인 경우
  if (planNumber === null) {
    // null은 개별 카운트
    contentSeq.lastSequence++;
    return contentSeq.lastSequence;
  } else {
    // 새로운 plan_number인 경우 회차 증가
    if (!contentSeq.seenPlanNumbers.has(planNumber)) {
      contentSeq.seenPlanNumbers.add(planNumber);
      contentSeq.lastSequence++;
      contentSeq.planNumberToSequence.set(planNumber, contentSeq.lastSequence);
    }
    return contentSeq.planNumberToSequence.get(planNumber)!;
  }
}
```

### 2. 원본 플랜 정보 추적

episode 분할로 인해 여러 플랜으로 나뉘어도 원본 플랜 정보를 추적할 수 있도록 `_originalIndex`를 추가했습니다.

```typescript
const plansForAssign = datePlans.map((plan, originalIndex) => {
  return {
    // ... 기존 필드들 ...
    _originalIndex: originalIndex, // 원본 플랜 인덱스 저장
  };
});
```

### 3. 분할된 플랜에도 원본 인덱스 유지

`splitPlanTimeInputByEpisodes`로 분할된 플랜들도 원본 인덱스를 유지하도록 했습니다.

```typescript
const splitPlans = splitPlanTimeInputByEpisodes(p, contentDurationMap);
// 분할된 플랜들도 원본 인덱스 유지
return splitPlans.map((splitPlan) => ({
  ...splitPlan,
  _originalIndex: p._originalIndex,
}));
```

### 4. plan_number 추론 로직

현재 `ScheduledPlan` 타입에 `plan_number`가 없으므로, 같은 콘텐츠의 같은 범위를 가진 플랜들을 그룹화하여 `plan_number`를 추론합니다.

```typescript
// 같은 날짜에 같은 콘텐츠의 같은 범위를 가진 첫 번째 플랜의 인덱스를 plan_number로 사용
const sameRangePlans = datePlans.filter(
  (p) =>
    p.content_id === originalPlan.content_id &&
    p.planned_start_page_or_time === originalPlan.planned_start_page_or_time &&
    p.planned_end_page_or_time === originalPlan.planned_end_page_or_time
);
if (sameRangePlans.length > 0) {
  const firstSameRangeIndex = datePlans.findIndex(
    (p) => p === sameRangePlans[0]
  );
  planNumber = firstSameRangeIndex >= 0 ? firstSameRangeIndex + 1 : null;
}
```

### 5. 콘텐츠별 회차 사용

플랜 저장 시 `globalSequence` 대신 `contentSequence`를 사용하도록 변경했습니다.

```typescript
const contentSequence = calculateContentSequence(
  segment.plan.content_id,
  planNumber
);

planPayloads.push({
  // ... 기존 필드들 ...
  sequence: contentSequence, // 콘텐츠별 회차 사용
});
```

## 수정된 파일

- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`
  - 콘텐츠별 회차 계산 로직 추가
  - 원본 플랜 정보 추적 (`_originalIndex`)
  - 분할된 플랜에도 원본 정보 유지
  - `plan_number` 추론 로직 추가
  - 플랜 저장 시 콘텐츠별 회차 사용

## 결과

이제 다음과 같이 올바르게 동작합니다:

```
콘텐츠 A (수학 교재):
- 플랜 1: 1-9p → 회차 1 ✅
- 플랜 2: 10-18p → 회차 2 ✅

콘텐츠 B (영어 교재):
- 플랜 1: 1-10p → 회차 1 ✅ (콘텐츠 B의 1회차)
- 플랜 2: 11-20p → 회차 2 ✅ (콘텐츠 B의 2회차)
```

episode 분할 시:
```
콘텐츠 A 강의 (2-5강):
- 분할 전: 2-5강 → 회차 1
- 분할 후:
  - 2강 → 회차 1 ✅
  - 3강 → 회차 1 ✅ (같은 회차)
  - 4강 → 회차 1 ✅ (같은 회차)
  - 5강 → 회차 1 ✅ (같은 회차)
```

## 향후 개선 사항

1. **스케줄러에서 plan_number 생성**: 현재는 추론하고 있지만, 스케줄러에서 직접 `plan_number`를 생성하도록 개선 필요
2. **전역 회차 필드 추가**: 필요시 전체 플랜에 대한 전역 회차도 별도 필드로 저장 가능
3. **회차 계산 로직 통합**: `PlanListView` 등 다른 곳에서도 동일한 로직 사용하도록 유틸리티 함수로 분리

