# 전략과목/취약과목 배치 로직 수정

## 작업 일시
2024-12-09

## 문제 상황
전략과목을 주3일로 설정했지만, 학습일의 모든 날짜에 플랜이 배치되는 문제가 발생했습니다. `generate1730TimetablePlans` 함수에서 전략과목/취약과목 설정(`subject_allocations`, `content_allocations`)을 전혀 고려하지 않고 모든 콘텐츠를 모든 학습일에 배정하고 있었습니다.

## 수정 내용

### 1. 필요한 함수 import 추가
**파일**: `lib/plan/scheduler.ts`

- `getContentAllocation`: 콘텐츠의 전략/취약 설정 확인
- `calculateSubjectAllocationDates`: 배정할 날짜 계산
- `divideContentRange`: 학습 범위 분할
- `calculateStudyReviewCycle`: 학습일/복습일 주기 정보 생성
- `CycleDayInfo` 타입 import

```typescript
import {
  getContentAllocation,
  calculateSubjectAllocationDates,
  divideContentRange,
  calculateStudyReviewCycle,
  type CycleDayInfo,
} from "@/lib/plan/1730TimetableLogic";
```

### 2. 설정 추출 및 주기 정보 생성
**파일**: `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수

- `options`에서 `subject_allocations`, `content_allocations` 추출
- `calculateStudyReviewCycle`로 학습일/복습일 주기 정보 생성

```typescript
// 전략과목/취약과목 설정 추출
const subjectAllocations = options?.subject_allocations;
const contentAllocations = options?.content_allocations;

// 학습일/복습일 주기 정보 생성
const cycleDays = calculateStudyReviewCycle(
  periodStart,
  periodEnd,
  { study_days: studyDays, review_days: reviewDays },
  exclusions
);
```

### 3. 콘텐츠별 배정 날짜 계산
**파일**: `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수

- 각 콘텐츠에 대해 `getContentAllocation`으로 전략/취약 설정 확인
- `calculateSubjectAllocationDates`로 배정할 날짜 목록 계산
  - 취약과목: 모든 학습일
  - 전략과목: 주당 배정 일수(`weekly_days`)만큼만 선택

```typescript
const contentAllocationMap = new Map<string, string[]>();
filteredContents.forEach((content) => {
  const allocation = getContentAllocation(
    {
      content_type: content.content_type,
      content_id: content.content_id,
      subject_category: content.subject_category || undefined,
    },
    contentAllocations,
    subjectAllocations
  );

  const subjectAlloc = {
    subject_id: content.content_id,
    subject_name: content.subject_category || content.subject || "",
    subject_type: allocation.subject_type,
    weekly_days: allocation.weekly_days,
  };

  const allocatedDates = calculateSubjectAllocationDates(
    cycleDays,
    subjectAlloc
  );
  contentAllocationMap.set(content.content_id, allocatedDates);
});
```

### 4. 학습 범위 분할
**파일**: `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수

- `divideContentRange`로 배정된 날짜에 학습 범위 분할
- `start_range`를 기준으로 오프셋 적용

```typescript
const contentRangeMap = new Map<string, Map<string, { start: number; end: number }>>();
filteredContents.forEach((content) => {
  const allocatedDates = contentAllocationMap.get(content.content_id) || [];
  const rangeMap = divideContentRange(
    content.total_amount,
    allocatedDates,
    content.content_id
  );
  // start_range를 기준으로 오프셋 적용
  const adjustedRangeMap = new Map<string, { start: number; end: number }>();
  rangeMap.forEach((range, date) => {
    adjustedRangeMap.set(date, {
      start: content.start_range + range.start,
      end: content.start_range + range.end,
    });
  });
  contentRangeMap.set(content.content_id, adjustedRangeMap);
});
```

### 5. 배정된 날짜에만 플랜 생성
**파일**: `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수

- 기존: 모든 콘텐츠를 모든 학습일에 배정
- 수정: `contentRangeMap`을 사용하여 배정된 날짜에만 플랜 생성

```typescript
// 각 콘텐츠의 배정된 날짜에 대해 플랜 생성
sortedContents.forEach((content) => {
  const rangeMap = contentRangeMap.get(content.content_id);
  if (!rangeMap) return;

  rangeMap.forEach((range, date) => {
    // 이번 주의 학습일에 포함되는 날짜인지 확인
    if (!studyDaysList.includes(date)) return;

    if (!studyPlansByDate.has(date)) {
      studyPlansByDate.set(date, []);
    }
    studyPlansByDate.get(date)!.push({
      content,
      start: range.start,
      end: range.end,
    });
  });
});
```

## 수정된 파일
1. `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수 수정

## 예상 결과
- 전략과목(주2일 설정): 주당 2일만 플랜 배정
- 전략과목(주3일 설정): 주당 3일만 플랜 배정
- 전략과목(주4일 설정): 주당 4일만 플랜 배정
- 취약과목: 모든 학습일에 플랜 배정
- 배정되지 않은 날짜에는 해당 콘텐츠 플랜이 생성되지 않음

## 테스트 확인 사항
- [ ] 전략과목 주2일 설정 시 주당 2일만 배정되는지 확인
- [ ] 전략과목 주3일 설정 시 주당 3일만 배정되는지 확인
- [ ] 전략과목 주4일 설정 시 주당 4일만 배정되는지 확인
- [ ] 취약과목은 모든 학습일에 배정되는지 확인
- [ ] 복습일에는 학습일 배정 로직이 적용되지 않는지 확인
- [ ] 콘텐츠별 설정과 교과별 설정 모두 정상 작동하는지 확인

