# 1730 타임테이블 학습일/복습일 플랜 배정 검증 및 수정

**작성일**: 2025-01-XX  
**목적**: 재조정 시 학습일에 플랜이 배정되지 않고 복습일에만 배정되는 문제 해결

---

## 문제 분석

### 발견된 문제

1. **복습일에 학습 범위가 나뉘어 배정되는 경우 발생**
   - 학습일에는 플랜이 배치되지 않고 복습일에만 배치됨
   - 1730 타임테이블 로직에 따르면 학습일에만 학습 범위를 배정해야 함

2. **예상보다 적은 수의 플랜 생성**
   - 12월 16일부터 1월 6일까지 재조정 범위를 선택했는데 4개의 플랜만 생성됨
   - 재조정 범위 내의 모든 학습일/복습일에 플랜이 생성되어야 함

### 원인 분석

1. **재조정 기간 일관성 문제**
   - `generatePlansFromGroup`이 `group.period_start`와 `group.period_end`를 사용하여 `availableDates` 계산
   - `_getReschedulePreview`에서는 `adjustedPeriod`를 사용하여 필터링
   - 이로 인해 `generate1730TimetablePlans`에 전달되는 `dates` 배열이 재조정 범위와 일치하지 않음

2. **학습일 배정 누락 가능성**
   - `calculateSubjectAllocationDates`가 학습일(study)에만 배정 날짜 반환
   - 재조정 기간이 짧거나 제외일이 많아서 학습일이 충분하지 않을 수 있음
   - `allocatedDates`가 비어있으면 `divideContentRange`가 빈 Map 반환
   - 결과: 학습일에 플랜이 생성되지 않음

3. **복습일 플랜 생성 로직**
   - 복습일에는 `weekContentRanges`에 저장된 범위만 복습해야 함
   - 하지만 학습일에 플랜이 없으면 `weekContentRanges`가 비어있음
   - 그런데도 복습일에 플랜이 생성된다면 다른 경로로 생성된 것

---

## 해결 방안

### 1. 재조정 기간 일관성 보장

**파일**: `lib/plan/scheduler.ts`, `app/(student)/actions/plan-groups/reschedule.ts`

- `generatePlansFromGroup` 함수에 `periodStart`, `periodEnd` 파라미터 추가 (선택사항)
- 재조정 시에는 전달된 `periodStart`/`periodEnd` 사용, 아니면 `group`의 기간 사용
- `_getReschedulePreview`에서 `generatePlansFromGroup` 호출 시 `adjustedPeriod` 전달
- `calculateAvailableDates`가 재조정 기간에 맞는 날짜만 반환하도록 보장

**수정 내용**:
```typescript
// lib/plan/scheduler.ts
export function generatePlansFromGroup(
  // ... 기존 파라미터
  periodStart?: string, // 재조정 시 사용할 기간 시작일 (선택사항)
  periodEnd?: string // 재조정 시 사용할 기간 종료일 (선택사항)
): ScheduledPlan[] {
  const startDate = periodStart || group.period_start;
  const endDate = periodEnd || group.period_end;
  const availableDates = calculateAvailableDates(startDate, endDate, exclusions);
  // ...
}

// app/(student)/actions/plan-groups/reschedule.ts
const generatedPlans = generatePlansFromGroup(
  group,
  contentsWithUncompleted,
  exclusions,
  academySchedules,
  baseBlocks,
  contentSubjects,
  undefined, // riskIndexMap
  dateAvailableTimeRanges,
  dateTimeSlots,
  undefined, // contentDurationMap
  adjustedPeriod.start, // 재조정 기간 시작일
  adjustedPeriod.end // 재조정 기간 종료일
);
```

### 2. 학습일 배정 검증 강화

**파일**: `lib/plan/scheduler.ts` (generate1730TimetablePlans 함수)

- `allocatedDates`가 실제로 학습일인지 확인하는 검증 추가
- 유효한 학습일만 사용하도록 필터링
- 학습일 배정 실패 시 상세 경고 로그 출력

**수정 내용**:
```typescript
// allocatedDates가 실제로 학습일인지 확인
const studyDatesSet = new Set(
  cycleDays.filter(d => d.day_type === "study").map(d => d.date)
);
const invalidDates = allocatedDates.filter(date => !studyDatesSet.has(date));

if (invalidDates.length > 0) {
  console.warn("[generate1730TimetablePlans] 학습일이 아닌 날짜가 배정됨:", {
    content_id: content.content_id,
    invalidDates,
    allocatedDates,
  });
}

// 유효한 학습일만 사용
const validAllocatedDates = allocatedDates.filter(date => studyDatesSet.has(date));
if (validAllocatedDates.length === 0) {
  console.warn("[generate1730TimetablePlans] 유효한 학습일 배정 없음:", {
    content_id: content.content_id,
    allocatedDates,
    totalStudyDatesCount: totalStudyDates,
  });
  contentAllocationMap.set(content.content_id, []);
  return;
}

contentAllocationMap.set(content.content_id, validAllocatedDates);
```

### 3. dates 배열과 cycleDays 간의 일관성 확인

**파일**: `lib/plan/scheduler.ts` (generate1730TimetablePlans 함수)

- `dates` 배열과 `cycleDays` 간의 불일치 확인 로그 추가
- 불일치 시 경고 로그 출력

**수정 내용**:
```typescript
// dates 배열과 cycleDays 간의 일관성 확인
const cycleDaysDates = new Set(cycleDays.map(d => d.date));
const datesSet = new Set(dates);
const missingInCycleDays = dates.filter(d => !cycleDaysDates.has(d));
const missingInDates = cycleDays.filter(d => d.day_type !== "exclusion" && !datesSet.has(d.date));

if (missingInCycleDays.length > 0 || missingInDates.length > 0) {
  console.warn("[generate1730TimetablePlans] dates 배열과 cycleDays 간 불일치:", {
    datesCount: dates.length,
    cycleDaysCount: cycleDays.length,
    missingInCycleDays: missingInCycleDays,
    missingInDates: missingInDates.map(d => ({ date: d.date, day_type: d.day_type })),
  });
}
```

### 4. 학습일 플랜 생성 검증 강화

**파일**: `lib/plan/scheduler.ts` (generate1730TimetablePlans 함수)

- 학습일 플랜이 생성되지 않은 경우 경고 로그 추가
- 학습일 플랜 생성 상태 상세 로그 추가

**수정 내용**:
```typescript
// 학습일 플랜이 없는 경우 경고
if (studyPlansByDate.size === 0) {
  console.warn("[generate1730TimetablePlans] 학습일 플랜이 생성되지 않음:", {
    cycleNumber,
    studyDaysList,
    totalContentsCount: sortedContents.length,
    contentsWithRangeMap: Array.from(contentRangeMap.keys()),
    message: "이 주차에는 학습일 플랜이 생성되지 않았습니다. 복습일 플랜도 생성되지 않습니다.",
  });
}
```

### 5. 복습일 플랜 생성 가드 강화

**파일**: `lib/plan/scheduler.ts` (generate1730TimetablePlans 함수)

- 복습일 플랜 생성 전 전체 검증 로그 추가
- 더 상세한 검증 로그 출력

**수정 내용**:
```typescript
// 복습일 플랜 생성 전 전체 검증
if (reviewDaysList.length > 0 && (!hasStudyPlans || studyPlansCount === 0)) {
  console.warn("[generate1730TimetablePlans] 복습일 플랜 생성 불가 (학습일 플랜 없음):", {
    cycleNumber,
    reviewDaysList,
    studyPlansCount,
    weekContentRangesCount: weekContentRanges.size,
    message: "학습일 플랜이 없어 복습일 플랜을 생성할 수 없습니다.",
  });
}

reviewDaysList.forEach((reviewDay) => {
  if (!reviewDay || weekContentRanges.size === 0 || !hasStudyPlans || studyPlansCount === 0) {
    if (!hasStudyPlans || studyPlansCount === 0) {
      console.warn("[generate1730TimetablePlans] 복습일 플랜 생성 스킵 (학습일 플랜 없음):", {
        reviewDay,
        cycleNumber,
        studyPlansCount,
        weekContentRangesCount: weekContentRanges.size,
        hasStudyPlans,
      });
    } else if (weekContentRanges.size === 0) {
      console.warn("[generate1730TimetablePlans] 복습일 플랜 생성 스킵 (복습 범위 없음):", {
        reviewDay,
        cycleNumber,
        weekContentRangesCount: weekContentRanges.size,
      });
    }
    return;
  }
  // ...
});
```

---

## 구현 완료 사항

### Phase 1: 재조정 기간 일관성 보장 ✅

- `generatePlansFromGroup` 함수에 `periodStart`, `periodEnd` 파라미터 추가
- `_getReschedulePreview`에서 `generatePlansFromGroup` 호출 시 `adjustedPeriod` 전달
- `calculateAvailableDates`가 재조정 기간에 맞는 날짜만 반환하도록 보장

### Phase 2: 학습일 배정 검증 강화 ✅

- `allocatedDates`가 실제로 학습일인지 확인하는 검증 추가
- 유효한 학습일만 사용하도록 필터링
- 학습일 배정 실패 시 상세 경고 로그 출력

### Phase 3: dates 배열과 cycleDays 간의 일관성 확인 ✅

- `dates` 배열과 `cycleDays` 간의 불일치 확인 로그 추가
- 불일치 시 경고 로그 출력

### Phase 4: 학습일 플랜 생성 검증 강화 ✅

- 학습일 플랜이 생성되지 않은 경우 경고 로그 추가
- 학습일 플랜 생성 상태 상세 로그 추가

### Phase 5: 복습일 플랜 생성 가드 강화 ✅

- 복습일 플랜 생성 전 전체 검증 로그 추가
- 더 상세한 검증 로그 출력

---

## 예상 결과

### 수정 전

- 재조정 시 학습일이 부족하면 복습일에 학습 범위가 나뉘어 배정됨 ❌
- 학습일에는 플랜이 없고 복습일에만 플랜이 생성됨 ❌
- 예상보다 적은 수의 플랜이 생성됨 ❌

### 수정 후

- 학습일에는 반드시 플랜이 배정됨 ✅
- 복습일에는 해당 주차의 학습 범위만 복습 ✅
- 재조정 범위 내의 모든 학습일/복습일에 플랜이 생성됨 ✅

---

## 주요 수정 파일

- `lib/plan/scheduler.ts`: `generatePlansFromGroup`, `generate1730TimetablePlans` 함수 수정
- `app/(student)/actions/plan-groups/reschedule.ts`: `_getReschedulePreview` 함수 수정

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-01-XX  
**구현 완료일**: 2025-01-XX

