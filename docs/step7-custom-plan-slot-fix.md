# Step7 커스텀 플랜 이동시간/학원일정 슬롯 표시 개선

## 문제 상황

Step7 스케줄 결과의 일별 스케줄 "시간 구성"에서 커스텀 유형의 이동시간/학원일정 플랜이 "(플랜 N개 - 시간 정보 없음)"으로 표시되는 문제가 발생했습니다.

## 원인 분석

### 기존 로직의 문제점

1. **학습시간/자율학습 슬롯에만 플랜 배치**
   - `TimeSlotsWithPlans` 컴포넌트에서 `studyTimeSlots`는 "학습시간"과 "자율학습"만 필터링
   - 플랜 배치 로직이 `studyTimeSlots`에만 적용됨

2. **이동시간/학원일정 슬롯에 플랜 배치 안 함**
   - 이동시간/학원일정 슬롯에는 플랜을 배치하는 로직이 없음
   - 커스텀 플랜이 이동시간/학원일정과 관련된 경우에도 학습시간 슬롯에만 배치 시도

3. **커스텀 플랜 구분 없음**
   - 커스텀 플랜과 일반 플랜을 구분하지 않음
   - 이동시간/학원일정 슬롯에 어떤 플랜을 표시할지 명확하지 않음

## 해결 방법

### 1. 이동시간/학원일정 슬롯 필터링 추가

```typescript
// 이동시간과 학원일정 슬롯 필터링
const travelAndAcademySlots = timeSlots.filter(
  (slot) => slot.type === "이동시간" || slot.type === "학원일정"
);
```

### 2. 커스텀 플랜 별도 처리

커스텀 플랜만 별도로 필터링하여 이동시간/학원일정 슬롯에 배치:

```typescript
// 커스텀 플랜만 별도로 처리 (이동시간/학원일정 슬롯에 배치)
const customPlansWithInfo = plansWithInfo.filter(
  (p) => p.plan.content_type === "custom"
);
```

### 3. 이동시간/학원일정 슬롯에 플랜 배치 로직 추가

커스텀 플랜을 이동시간/학원일정 슬롯에 배치:

```typescript
travelAndAcademySlots.forEach((slot, slotIdx) => {
  const slotStart = timeToMinutes(slot.start);
  const slotEnd = timeToMinutes(slot.end);
  const plansInSlot = [];

  // 커스텀 플랜 중에서 이 슬롯과 시간이 일치하는 플랜 찾기
  for (const planInfo of customPlansWithInfo) {
    // 시작 시간이 있는 경우: 슬롯과 시간이 겹치는지 확인
    if (planInfo.originalStartTime !== null) {
      const planStart = planInfo.originalStartTime;
      const planEnd = planStart + planInfo.originalEstimatedTime;

      // 플랜이 이 슬롯과 겹치는지 확인
      if (planStart < slotEnd && planEnd > slotStart) {
        const slotAvailableStart = Math.max(planStart, slotStart);
        const slotAvailableEnd = Math.min(planEnd, slotEnd);

        if (slotAvailableStart < slotAvailableEnd) {
          plansInSlot.push({
            plan: planInfo.plan,
            start: minutesToTime(slotAvailableStart),
            end: minutesToTime(slotAvailableEnd),
            isPartial: false,
            isContinued: false,
            originalEstimatedTime: planInfo.originalEstimatedTime,
          });
        }
      }
    } else {
      // 시작 시간이 없는 경우: 슬롯 시간에 맞춰 배치
      const timeToUse = Math.min(planInfo.estimatedTime, slotEnd - slotStart);
      if (timeToUse > 0) {
        plansInSlot.push({
          plan: planInfo.plan,
          start: slot.start,
          end: minutesToTime(slotStart + timeToUse),
          isPartial: planInfo.estimatedTime > timeToUse,
          isContinued: false,
          originalEstimatedTime: planInfo.originalEstimatedTime,
        });
      }
    }
  }

  if (plansInSlot.length > 0) {
    travelAndAcademyPlansMap.set(slotIdx, plansInSlot);
  }
});
```

### 4. 슬롯 인덱스 매핑 추가

이동시간/학원일정 슬롯의 인덱스를 매핑:

```typescript
// 이동시간/학원일정 슬롯 인덱스 매핑
const travelAndAcademySlotIndexMap = new Map<number, number>();
let travelAndAcademySlotIdx = 0;
timeSlots.forEach((slot, idx) => {
  if (slot.type === "이동시간" || slot.type === "학원일정") {
    travelAndAcademySlotIndexMap.set(idx, travelAndAcademySlotIdx);
    travelAndAcademySlotIdx++;
  }
});
```

### 5. UI 표시 로직 개선

학습시간 슬롯과 이동시간/학원일정 슬롯을 구분하여 표시:

```typescript
// 학습시간 슬롯에는 커스텀이 아닌 플랜만 표시
const nonCustomPlans = datePlans.filter(p => p.content_type !== "custom");
// 이동시간/학원일정 슬롯에는 커스텀 플랜만 표시
const customPlans = datePlans.filter(p => p.content_type === "custom");

// 학습시간 슬롯
{slot.type === "학습시간" && (
  <>
    {plansInStudySlot.length > 0 ? (
      <PlanTable plans={plansInStudySlot} ... />
    ) : nonCustomPlans.length > 0 ? (
      <div>(플랜 {nonCustomPlans.length}개 - 시간 정보 없음)</div>
    ) : null}
  </>
)}

// 이동시간/학원일정 슬롯
{(slot.type === "이동시간" || slot.type === "학원일정") && (
  <>
    {plansInTravelAndAcademySlot.length > 0 ? (
      <PlanTable plans={plansInTravelAndAcademySlot} ... />
    ) : customPlans.length > 0 ? (
      <div>(커스텀 플랜 {customPlans.length}개 - 시간 정보 없음)</div>
    ) : null}
  </>
)}
```

## 변경 사항 요약

### `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

1. **이동시간/학원일정 슬롯 필터링 추가**
   - `travelAndAcademySlots` 변수 추가

2. **커스텀 플랜 별도 처리**
   - `customPlansWithInfo` 변수 추가
   - 커스텀 플랜만 필터링하여 이동시간/학원일정 슬롯에 배치

3. **이동시간/학원일정 슬롯에 플랜 배치 로직 추가**
   - `travelAndAcademyPlansMap` 생성
   - 시간 매칭 로직 구현 (시작 시간이 있으면 겹침 확인, 없으면 슬롯 시간에 맞춰 배치)

4. **슬롯 인덱스 매핑 추가**
   - `travelAndAcademySlotIndexMap` 생성
   - 이동시간/학원일정 슬롯의 인덱스를 매핑

5. **UI 표시 로직 개선**
   - 학습시간 슬롯: 커스텀이 아닌 플랜만 표시
   - 이동시간/학원일정 슬롯: 커스텀 플랜만 표시
   - 각 슬롯 타입별로 적절한 플랜 표시

## 동작 방식

### 플랜 배치 우선순위

1. **학습시간 슬롯**
   - 일반 플랜(book, lecture) 배치
   - 커스텀 플랜은 제외

2. **이동시간/학원일정 슬롯**
   - 커스텀 플랜만 배치
   - 시간 매칭:
     - 시작 시간이 있으면: 슬롯과 시간이 겹치는지 확인하여 배치
     - 시작 시간이 없으면: 슬롯 시간에 맞춰 배치

### 시간 매칭 로직

1. **시작 시간이 있는 경우**
   - 플랜의 시작/종료 시간과 슬롯의 시작/종료 시간이 겹치는지 확인
   - 겹치는 경우 해당 시간 범위에 플랜 배치

2. **시작 시간이 없는 경우**
   - 슬롯의 시작 시간부터 플랜의 예상 소요시간만큼 배치
   - 예상 소요시간이 슬롯 시간보다 크면 부분 배치 (isPartial: true)

## 테스트 방법

1. 커스텀 유형의 이동시간/학원일정 플랜 생성
2. Step7 스케줄 결과 페이지에서 확인:
   - 이동시간 슬롯에 커스텀 플랜이 표시되는지 확인
   - 학원일정 슬롯에 커스텀 플랜이 표시되는지 확인
   - 학습시간 슬롯에는 커스텀 플랜이 표시되지 않는지 확인

## 추가 개선 사항 (시간 정보 없음 메시지 개선)

### 문제
이동시간/학원일정 슬롯에 커스텀 플랜이 배치되어도 "시간 정보 없음" 메시지가 함께 표시되는 문제가 발생했습니다.

### 원인
- `customPlans.length > 0` 조건이 해당 날짜의 모든 커스텀 플랜을 체크
- 일부 플랜이 배치되어도 배치되지 않은 다른 플랜이 있으면 메시지가 표시됨

### 해결
1. **배치된 플랜 ID 추적**: 모든 이동시간/학원일정 슬롯에서 배치된 플랜 ID를 수집
2. **배치되지 않은 플랜 필터링**: 배치된 플랜 ID를 제외하여 `unplacedCustomPlans` 생성
3. **UI 표시 로직 개선**: 배치된 플랜이 있으면 PlanTable만 표시, 없으면 배치되지 않은 커스텀 플랜만 "시간 정보 없음" 표시

```typescript
// 모든 이동시간/학원일정 슬롯에서 배치된 플랜 ID 수집
const placedPlanIds = new Set<string>();
travelAndAcademyPlansMap.forEach((plans) => {
  plans.forEach((p) => {
    placedPlanIds.add(p.plan.id);
  });
});

// 배치되지 않은 커스텀 플랜만 필터링
const unplacedCustomPlans = customPlans.filter(
  (p) => !placedPlanIds.has(p.id)
);

// UI 표시
{plansInTravelAndAcademySlot.length > 0 ? (
  <PlanTable ... />
) : unplacedCustomPlans.length > 0 ? (
  <div>(커스텀 플랜 {unplacedCustomPlans.length}개 - 시간 정보 없음)</div>
) : null}
```

## 주의사항

- 커스텀 플랜은 이동시간/학원일정 슬롯에만 배치됩니다.
- 학습시간 슬롯에는 일반 플랜(book, lecture)만 배치됩니다.
- 시간 정보가 없는 커스텀 플랜은 슬롯 시간에 맞춰 자동 배치됩니다.
- 시간 정보가 있는 커스텀 플랜은 슬롯과 시간이 겹치는 경우에만 배치됩니다.
- 배치된 플랜이 있으면 "시간 정보 없음" 메시지가 표시되지 않습니다.
- 배치되지 않은 커스텀 플랜만 "시간 정보 없음"으로 표시됩니다.

## 관련 파일

- `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
  - `TimeSlotsWithPlans` 컴포넌트 (플랜 배치 로직)
  - 이동시간/학원일정 슬롯 플랜 배치 로직 추가

---

**작성일**: 2024년 11월  
**관련 이슈**: Step7 커스텀 플랜 이동시간/학원일정 슬롯 표시 문제

