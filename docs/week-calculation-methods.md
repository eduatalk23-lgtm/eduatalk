# 주차 계산 방법 정리

## 개요

플랜 그룹에서 주차 정보를 계산하는 방법은 **스케줄러 타입**에 따라 다릅니다.

## 두 가지 주차 계산 방법

### 방법 1: 간단한 주차 계산 (`calculateWeekNumber`)

**위치**: `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`

**규칙**:
- `period_start`부터 시작하여 **7일 단위**로 주차 계산
- **제외일을 고려하지 않음** (모든 날짜 포함)

**공식**:
```typescript
function calculateWeekNumber(planDate: string, periodStart: string): { week: number; day: number } {
  const start = new Date(periodStart);
  const current = new Date(planDate);
  
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  // 시작일부터 경과 일수 계산
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // 주차 계산 (1주차부터 시작, 7일 단위)
  const week = Math.floor(diffDays / 7) + 1;
  
  // 일차 계산 (해당 주의 몇 번째 날인지, 시작일=1일차)
  const day = (diffDays % 7) + 1;
  
  return { week, day };
}
```

**예시**:
```
period_start: 2025-01-01 (수요일)

2025-01-01 (수) → 1주차-1일
2025-01-02 (목) → 1주차-2일
2025-01-03 (금) → 1주차-3일
...
2025-01-07 (화) → 1주차-7일
2025-01-08 (수) → 2주차-1일
```

**특징**:
- ✅ 간단하고 직관적
- ✅ 제외일 여부와 관계없이 일관된 주차 계산
- ❌ 제외일이 많으면 실제 학습 가능한 날짜와 주차가 불일치할 수 있음

**사용 케이스**:
- 자동 스케줄러
- 간단한 주차 표시가 필요한 경우

---

### 방법 2: 1730 Timetable 주차 계산 (`calculateWeeksFor1730`)

**위치**: `lib/scheduler/calculateAvailableDates.ts`

**규칙**:
- **제외일(휴가, 개인사정, 지정휴일)을 완전히 제외**
- 제외일이 아닌 날짜만으로 **7일 단위** 주차 계산
- 제외일은 주차에 포함되지 않음

**공식**:
```typescript
function calculateWeeksFor1730(dates: Date[], exclusions: Exclusion[]): Map<number, Date[]> {
  const weeks = new Map<number, Date[]>();
  let currentWeek = 1;
  let currentWeekDates: Date[] = [];

  for (const date of dates) {
    const dateStr = formatDate(date);
    const exclusion = getExclusionForDate(dateStr, exclusions);

    // 모든 제외일(휴가, 개인사정, 지정휴일)은 주차 계산에서 제외
    if (exclusion) {
      continue; // 제외일은 주차에 포함하지 않음
    }

    // 제외일이 아닌 날짜만 주차에 포함
    currentWeekDates.push(date);

    // 7일이 되면 다음 주차로
    if (currentWeekDates.length >= 7) {
      weeks.set(currentWeek, [...currentWeekDates]);
      currentWeek++;
      currentWeekDates = [];
    }
  }

  // 남은 날짜 처리
  if (currentWeekDates.length > 0) {
    weeks.set(currentWeek, currentWeekDates);
  }

  return weeks;
}
```

**예시**:
```
period_start: 2025-01-01 (수요일)
제외일: 2025-01-03 (금요일 - 휴가), 2025-01-05 (일요일 - 지정휴일)

실제 날짜:
2025-01-01 (수) → 1주차-1일 ✅ (제외일 아님)
2025-01-02 (목) → 1주차-2일 ✅ (제외일 아님)
2025-01-03 (금) → 주차 없음 ❌ (제외일)
2025-01-04 (토) → 1주차-3일 ✅ (제외일 아님)
2025-01-05 (일) → 주차 없음 ❌ (제외일)
2025-01-06 (월) → 1주차-4일 ✅ (제외일 아님)
...
```

**특징**:
- ✅ 실제 학습 가능한 날짜만으로 주차 구성
- ✅ 제외일이 많아도 주차 계산이 정확함
- ❌ 제외일은 주차에 포함되지 않아 날짜와 주차가 불일치할 수 있음

**사용 케이스**:
- 1730 Timetable 스케줄러
- 제외일을 고려한 정확한 주차 계산이 필요한 경우

---

## 주차 정보 저장 시 사용할 방법

### 권장 방법

**`calculateAvailableDates` 결과 사용** (이미 계산되어 있음)

```typescript
// calculateAvailableDates 결과
const scheduleResult = calculateAvailableDates(...);

// daily_schedule에서 주차 정보 가져오기
scheduleResult.daily_schedule.forEach((daily) => {
  const weekNumber = daily.week_number; // 이미 계산된 주차 번호
  
  // 해당 날짜의 플랜에 주차 정보 저장
  plans.forEach((plan) => {
    if (plan.plan_date === daily.date) {
      plan.week = weekNumber;
      // day는 별도 계산 필요 (해당 주의 몇 번째 날인지)
    }
  });
});
```

### 주차별 일차(day) 계산

주차 번호는 `calculateAvailableDates`에서 제공되지만, **해당 주의 일차(day)**는 별도 계산이 필요합니다.

**방법 1 사용 시**:
```typescript
const { week, day } = calculateWeekNumber(planDate, periodStart);
```

**방법 2 사용 시**:
```typescript
// calculateWeeksFor1730 결과에서 해당 주차의 날짜 목록 가져오기
const weeks = calculateWeeksFor1730(dates, exclusions);
const weekDates = weeks.get(weekNumber) || [];

// 해당 날짜가 주차 내에서 몇 번째인지 계산
const day = weekDates.findIndex(d => formatDate(d) === planDate) + 1;
```

---

## 구현 시 고려사항

### 1. 스케줄러 타입별 주차 계산

```typescript
// _generatePlansFromGroup 내부
const scheduleResult = calculateAvailableDates(...);

// 날짜별 주차 정보 매핑
const weekMap = new Map<string, number>();
const dayMap = new Map<string, number>();

if (group.scheduler_type === "1730_timetable") {
  // 1730 Timetable: calculateAvailableDates 결과 사용
  scheduleResult.daily_schedule.forEach((daily) => {
    if (daily.week_number) {
      weekMap.set(daily.date, daily.week_number);
      
      // 해당 주차의 일차 계산
      const weekDates = scheduleResult.daily_schedule
        .filter(d => d.week_number === daily.week_number && d.day_type !== "휴가" && d.day_type !== "개인사정" && d.day_type !== "지정휴일")
        .map(d => d.date)
        .sort();
      
      const dayIndex = weekDates.indexOf(daily.date);
      if (dayIndex >= 0) {
        dayMap.set(daily.date, dayIndex + 1);
      }
    }
  });
} else {
  // 자동 스케줄러: 간단한 계산
  for (const [date, datePlans] of plansByDate.entries()) {
    const { week, day } = calculateWeekNumber(date, group.period_start);
    weekMap.set(date, week);
    dayMap.set(date, day);
  }
}

// 플랜 저장 시 주차 정보 포함
planPayloads.push({
  // ...
  week: weekMap.get(date) || null,
  day: dayMap.get(date) || null,
});
```

### 2. 제외일 처리

- **방법 1**: 제외일도 주차에 포함 (주차 번호는 있지만, 실제로는 학습하지 않음)
- **방법 2**: 제외일은 주차에 포함하지 않음 (주차 번호 자체가 없음)

**권장**: 방법 2 사용 시, 제외일의 `week`와 `day`는 `null`로 저장

---

## 요약

| 구분 | 방법 1 (간단) | 방법 2 (1730 Timetable) |
|------|--------------|------------------------|
| **제외일 처리** | 포함 (주차에 포함) | 제외 (주차에서 제외) |
| **계산 복잡도** | 낮음 | 높음 |
| **정확도** | 낮음 (제외일 고려 안 함) | 높음 (제외일 고려) |
| **사용 케이스** | 자동 스케줄러 | 1730 Timetable |
| **데이터 출처** | `calculateWeekNumber` 함수 | `calculateAvailableDates` 결과 |

**최종 권장**: `calculateAvailableDates` 결과의 `week_number`를 사용하고, 스케줄러 타입에 따라 일차(day) 계산 방법 선택

