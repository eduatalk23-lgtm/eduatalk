# 플랜 시간 정보 저장 분석 및 개선 방향

## 현재 상황 분석

### 1. Step7 타임라인 표시 로직 (`ScheduleTableView.tsx`)

Step7에서 타임라인 테이블에 표시되는 시간 정보는 `TimeSlotsWithPlans` 함수에서 동적으로 계산됩니다:

```typescript
// TimeSlotsWithPlans 함수의 핵심 로직:
// 1. 플랜의 예상 소요시간 계산 (calculateEstimatedTime)
// 2. 학습시간 슬롯에 플랜을 시간 순으로 배치
// 3. 각 플랜의 실제 시작/종료 시간 계산 (예: "10:00 ~ 11:18", "11:18 ~ 12:00")
```

**특징:**

- 플랜의 소요시간을 기반으로 정확한 시간 계산
- 여러 블록에 걸쳐 배치 가능 (예: "10:00 ~ 11:18", "11:18 ~ 12:00")
- 복습일의 경우 소요시간 단축 적용 (50%)
- 플랜이 일부만 배치되는 경우 "(일부)" 표시

### 2. 현재 저장 로직 (`_generatePlansFromGroup`)

현재 `_generatePlansFromGroup` 함수에서는 다음과 같이 시간 정보를 저장합니다:

```typescript
// 1517-1528 라인
const timeSlotIndex = nextBlockIndex - 1;
const matchingTimeSlot = studyTimeSlots[timeSlotIndex] || null;

if (matchingTimeSlot) {
  planStartTime = matchingTimeSlot.start; // 예: "10:00"
  planEndTime = matchingTimeSlot.end; // 예: "12:00"
}
```

**문제점:**

- `studyTimeSlots`의 전체 시간 범위를 그대로 저장 (예: "10:00 ~ 12:00")
- Step7에서 보여주는 정확한 시간 (예: "10:00 ~ 11:18", "11:18 ~ 12:00")과 불일치
- 플랜의 실제 소요시간을 고려하지 않음
- 복습일의 소요시간 단축이 반영되지 않음

### 3. 사용자가 원하는 시간 정보

사용자가 저장하기를 원하는 시간 정보는 Step7 타임라인 테이블에 표시되는 시간입니다:

```
10:00 ~ 11:18  (1시간 18분)
11:18 ~ 12:00  (42분) (일부)
13:00 ~ 13:36  (36분) [이어서]
13:36 ~ 15:00  (1시간 24분)
15:00 ~ 16:12  (1시간 12분)
```

## 중요한 발견: 쪼개진 플랜 처리 문제

### 현재 상황

Step7 타임라인에서는 하나의 플랜이 여러 블록에 걸쳐 쪼개져서 표시됩니다:

```
원래 플랜: 1-14p (총 2시간)
↓
Step7 표시:
  - 10:00 ~ 11:18 (1시간 18분) - 첫 번째 블록
  - 11:18 ~ 12:00 (42분) (일부) - 두 번째 블록
```

하지만 현재 `_generatePlansFromGroup`에서는:

- 각 플랜을 **하나의 레코드**로만 저장
- 쪼개진 부분을 고려하지 않음
- 첫 번째 블록의 시간만 저장되거나, 전체 블록 시간이 저장됨

### 문제점

1. **데이터 불일치**: Step7에서 보여주는 쪼개진 시간 정보와 저장되는 시간 정보가 다름
2. **정보 손실**: 두 번째 블록 이후의 시간 정보가 저장되지 않음
3. **표시 오류**: 플랜 캘린더에서 쪼개진 플랜을 정확히 표시할 수 없음

### 해결 방안

**옵션 A: 하나의 플랜을 여러 레코드로 쪼개서 저장** (권장)

- 각 쪼개진 부분마다 별도 레코드 생성
- 각 레코드는 동일한 `content_id`, `planned_start_page_or_time`, `planned_end_page_or_time`을 가짐
- 각 레코드는 다른 `block_index`와 `start_time`, `end_time`을 가짐
- 장점: Step7 표시와 정확히 일치, 모든 시간 정보 보존
- 단점: 하나의 논리적 플랜이 여러 물리적 레코드로 분리됨

**옵션 B: 하나의 레코드로 저장하되, 첫 번째 블록의 시간만 저장**

- 첫 번째 블록의 `start_time`, `end_time`만 저장
- 장점: 데이터 모델 단순화
- 단점: 두 번째 블록 이후의 시간 정보 손실

## 개선 방향

### 방안 1: Step7 로직을 서버 액션에 통합 + 쪼개진 플랜 처리 (권장)

**장점:**

- Step7과 저장되는 시간 정보가 정확히 일치
- 플랜의 실제 소요시간을 정확히 반영
- 복습일 소요시간 단축 자동 적용

**구현 방법:**

1. `TimeSlotsWithPlans` 함수의 시간 배치 로직을 서버 액션으로 이식
2. `_generatePlansFromGroup`에서 플랜 생성 시 동일한 로직 적용
3. **하나의 플랜이 여러 블록에 걸쳐 쪼개지는 경우, 각 쪼개진 부분마다 별도 레코드 생성**
4. 각 레코드의 정확한 시작/종료 시간 계산 및 저장

**필요한 함수:**

- `calculateEstimatedTime`: 플랜의 예상 소요시간 계산 (분 단위)
- `timeToMinutes`: 시간 문자열을 분 단위로 변환
- `minutesToTime`: 분 단위를 시간 문자열로 변환
- 플랜 배치 로직: 학습시간 슬롯에 플랜을 시간 순으로 배치

### 방안 2: 스케줄러에서 정확한 시간 반환

**장점:**

- 스케줄러가 시간 정보를 직접 제공
- 서버 액션 로직 단순화

**단점:**

- 스케줄러 로직 수정 필요
- Step7 표시 로직과 중복 가능성

### 방안 3: 플랜 생성 후 시간 정보 업데이트

**장점:**

- 기존 로직 유지 가능
- 별도 업데이트 단계로 분리

**단점:**

- 추가 데이터베이스 업데이트 작업 필요
- 성능 오버헤드

## 권장 구현 방안 (방안 1)

### 1. 시간 계산 유틸리티 함수 생성

```typescript
// lib/plan/planTimeCalculation.ts
export function calculatePlanEstimatedTime(
  plan: ScheduledPlan,
  contentDurationMap: ContentDurationMap,
  dayType: "학습일" | "복습일" | null
): number {
  // Step7의 calculateEstimatedTime 로직과 동일
  // - 책: 1시간당 10페이지 가정
  // - 강의: duration 정보 사용
  // - 복습일: 50% 단축
}
```

### 2. 플랜 시간 배치 로직 구현 (쪼개진 플랜 처리 포함)

```typescript
// _generatePlansFromGroup 내부
type PlanTimeSegment = {
  plan: ScheduledPlan;
  start: string;
  end: string;
  isPartial: boolean; // 일부만 배치된 경우
  isContinued: boolean; // 이전 블록에서 이어지는 경우
  blockIndex: number; // 배치된 블록 인덱스
};

function assignPlanTimes(
  datePlans: ScheduledPlan[],
  studyTimeSlots: Array<{ start: string; end: string }>,
  contentDurationMap: ContentDurationMap,
  dayType: "학습일" | "복습일" | null
): PlanTimeSegment[] {
  // Step7의 TimeSlotsWithPlans 로직과 동일하게 구현
  // 1. 플랜의 예상 소요시간 계산
  // 2. 학습시간 슬롯에 시간 순으로 배치
  // 3. 하나의 플랜이 여러 블록에 걸쳐 쪼개지는 경우, 각 쪼개진 부분을 별도 세그먼트로 반환
  // 4. 각 세그먼트의 정확한 시작/종료 시간 및 block_index 반환
  // 반환 예시:
  // [
  //   { plan: plan1, start: "10:00", end: "11:18", isPartial: true, isContinued: false, blockIndex: 1 },
  //   { plan: plan1, start: "11:18", end: "12:00", isPartial: false, isContinued: true, blockIndex: 2 },
  //   { plan: plan2, start: "13:00", end: "15:00", isPartial: false, isContinued: false, blockIndex: 3 },
  // ]
}
```

### 3. \_generatePlansFromGroup 수정 (쪼개진 플랜 처리)

```typescript
// 날짜별로 처리
for (const [date, datePlans] of plansByDate.entries()) {
  // dayType 계산
  const dayType = calculateDayType(date, group.period_start, ...);

  // 학습시간 슬롯 필터링
  const studyTimeSlots = dateTimeSlots.get(date)?.filter(...) || [];

  // 플랜 시간 배치 (Step7 로직 적용, 쪼개진 플랜 처리 포함)
  const planTimeSegments = assignPlanTimes(
    datePlans,
    studyTimeSlots,
    contentDurationMap,
    dayType
  );

  // 각 세그먼트마다 별도 레코드 생성 (쪼개진 플랜 처리)
  for (const segment of planTimeSegments) {
    // 기존 플랜과 겹치지 않는 block_index 찾기
    const usedIndices = usedBlockIndicesByDate.get(date) || new Set<number>();
    let nextBlockIndex = 1;
    while (usedIndices.has(nextBlockIndex)) {
      nextBlockIndex++;
    }
    usedIndices.add(nextBlockIndex);
    usedBlockIndicesByDate.set(date, usedIndices);

    planPayloads.push({
      // ...
      block_index: nextBlockIndex, // 쪼개진 각 부분마다 다른 block_index
      planned_start_page_or_time: segment.plan.planned_start_page_or_time,
      planned_end_page_or_time: segment.plan.planned_end_page_or_time,
      // 동일한 content_id와 페이지 범위를 유지 (논리적으로는 같은 플랜)
      start_time: segment.start, // 쪼개진 각 부분의 정확한 시작 시간
      end_time: segment.end,     // 쪼개진 각 부분의 정확한 종료 시간
    });
  }
}
```

**중요 사항:**

- 하나의 논리적 플랜이 여러 물리적 레코드로 저장됨
- 각 레코드는 동일한 `plan_group_id`, `plan_date`, `content_id`, `planned_start_page_or_time`, `planned_end_page_or_time`을 가짐
- 각 레코드는 다른 `block_index`, `start_time`, `end_time`을 가짐
- **식별 방법**: 다음 조합으로 같은 논리적 플랜을 식별 가능
  - `plan_group_id` + `plan_date` + `content_id` + `planned_start_page_or_time` + `planned_end_page_or_time`
- 플랜 캘린더에서 조회 시, 위 조합으로 그룹화하여 하나의 논리적 플랜으로 표시
- `block_index` 순서로 정렬하여 쪼개진 순서 유지

## 구현 단계

1. **1단계**: 시간 계산 유틸리티 함수 생성

   - `calculatePlanEstimatedTime` 함수 구현
   - `timeToMinutes`, `minutesToTime` 유틸리티 함수 추가

2. **2단계**: 플랜 시간 배치 로직 구현

   - `assignPlanTimes` 함수 구현
   - Step7의 `TimeSlotsWithPlans` 로직과 동일하게 구현

3. **3단계**: `_generatePlansFromGroup` 수정

   - 기존 시간 정보 저장 로직 제거
   - 새로운 `assignPlanTimes` 함수 사용

4. **4단계**: 테스트 및 검증
   - Step7 표시 시간과 저장된 시간 일치 확인
   - 복습일 소요시간 단축 확인
   - 여러 블록에 걸친 플랜 배치 확인

## 예상 결과

### 저장 전 (현재)

```
원래 플랜 1개: 1-14p, start_time: "10:00", end_time: "12:00"
원래 플랜 1개: 1-15p, start_time: "13:00", end_time: "19:00"
```

### 저장 후 (개선 - 쪼개진 플랜 처리 포함)

**원래 플랜 1개 (1-14p)가 2개 레코드로 쪼개짐:**

```
레코드 1:
  - content_id: "book-123", planned_start_page_or_time: 1, planned_end_page_or_time: 14
  - block_index: 1, start_time: "10:00", end_time: "11:18"  (1시간 18분)

레코드 2:
  - content_id: "book-123", planned_start_page_or_time: 1, planned_end_page_or_time: 14
  - block_index: 2, start_time: "11:18", end_time: "12:00"  (42분, 일부)
```

**원래 플랜 1개 (1-15p)가 3개 레코드로 쪼개짐:**

```
레코드 3:
  - content_id: "book-456", planned_start_page_or_time: 1, planned_end_page_or_time: 15
  - block_index: 3, start_time: "13:00", end_time: "13:36"  (36분, 이어서)

레코드 4:
  - content_id: "book-456", planned_start_page_or_time: 1, planned_end_page_or_time: 15
  - block_index: 4, start_time: "13:36", end_time: "15:00"  (1시간 24분)

레코드 5:
  - content_id: "book-789", planned_start_page_or_time: 1, planned_end_page_or_time: 13
  - block_index: 5, start_time: "15:00", end_time: "16:12"  (1시간 12분)
```

### 플랜 캘린더 표시 시 고려사항

플랜 캘린더에서 조회할 때는:

1. **그룹화 키**: `plan_group_id` + `plan_date` + `content_id` + `planned_start_page_or_time` + `planned_end_page_or_time`
   - 이 조합이 동일한 레코드들은 하나의 논리적 플랜으로 인식
2. **정렬**: `block_index` 순서로 정렬하여 쪼개진 순서 유지
3. **표시**: 각 그룹을 하나의 논리적 플랜으로 표시하되, 각 레코드의 `start_time`, `end_time`을 타임라인에 정확히 표시

**예시:**

```typescript
// 조회된 레코드들
const plans = [
  {
    id: "1",
    plan_group_id: "group-1",
    plan_date: "2025-01-01",
    content_id: "book-123",
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 14,
    block_index: 1,
    start_time: "10:00",
    end_time: "11:18",
  },
  {
    id: "2",
    plan_group_id: "group-1",
    plan_date: "2025-01-01",
    content_id: "book-123",
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 14,
    block_index: 2,
    start_time: "11:18",
    end_time: "12:00",
  },
  {
    id: "3",
    plan_group_id: "group-1",
    plan_date: "2025-01-01",
    content_id: "book-456",
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 15,
    block_index: 3,
    start_time: "13:00",
    end_time: "15:00",
  },
];

// 그룹화
const groupedPlans = groupBy(
  plans,
  (p) =>
    `${p.plan_group_id}-${p.plan_date}-${p.content_id}-${p.planned_start_page_or_time}-${p.planned_end_page_or_time}`
);

// 결과:
// 그룹 1: [레코드 1, 레코드 2] - 하나의 논리적 플랜 (book-123, 1-14p)
// 그룹 2: [레코드 3] - 하나의 논리적 플랜 (book-456, 1-15p)
```

이렇게 하면 Step7에서 보여주는 시간 정보와 데이터베이스에 저장되는 시간 정보가 정확히 일치하게 되며, 쪼개진 플랜도 올바르게 처리됩니다.
