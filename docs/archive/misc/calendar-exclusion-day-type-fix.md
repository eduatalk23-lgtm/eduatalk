# 캘린더 제외일 타입 표시 및 학원일정 필터링 수정

## 📋 문제점

1. **제외일인데 학습일로 표시되는 문제**
   - 제외일이 있는 날짜인데도 `daily_schedule`에 "학습일"로 저장되어 있으면 학습일로 표시됨
   - 제외일이 최고 우선순위여야 하는데 덮어쓰기 로직 문제

2. **제외일인데 학원일정이 표시되는 문제**
   - 제외일이 있는 날짜에도 학원일정이 표시됨
   - 제외일에는 모든 학습 관련 일정이 숨겨져야 함

## 🔧 수정 내용

### 1. 제외일 타입 우선순위 강화 (`lib/date/calendarDayTypes.ts`)

**변경 전:**
- `daily_schedule`을 먼저 처리하고, 제외일 정보를 나중에 확인
- 우선순위 비교에서 제외일이 덮어쓰일 수 있음

**변경 후:**
- 제외일을 **먼저** 처리하여 `dayTypeMap`에 설정
- 제외일이 설정된 날짜는 `daily_schedule`의 정보로 덮어쓰지 않도록 보호
- `exclusion_type`과 `day_type` 간 올바른 매핑 추가:
  - `"휴가"` → `"휴가"`
  - `"개인사정"` → `"개인일정"`
  - `"휴일지정"` / `"기타"` → `"지정휴일"`

```typescript
// 먼저 제외일이 있는 날짜를 제외일 타입으로 설정 (최고 우선순위)
if (exclusions) {
  exclusions.forEach((exclusion) => {
    const dateStr = exclusion.exclusion_date.slice(0, 10);
    // 제외일 타입 결정 (exclusion_type에 따라 매핑)
    let exclusionDayType: DayType = "지정휴일";
    if (exclusion.exclusion_type === "휴가") {
      exclusionDayType = "휴가";
    } else if (exclusion.exclusion_type === "개인사정") {
      exclusionDayType = "개인일정";
    } else if (exclusion.exclusion_type === "휴일지정" || exclusion.exclusion_type === "기타") {
      exclusionDayType = "지정휴일";
    }
    
    dayTypeMap.set(dateStr, {
      ...DAY_TYPE_INFO[exclusionDayType],
      type: exclusionDayType,
      exclusion: {
        exclusion_date: exclusion.exclusion_date,
        exclusion_type: exclusion.exclusion_type,
        reason: exclusion.reason || null,
      },
    });
  });
}

// daily_schedule 처리 시 제외일이 이미 설정된 날짜는 덮어쓰지 않음
schedule.forEach((daily) => {
  const dateStr = daily.date.slice(0, 10);
  
  // 제외일이 이미 설정된 날짜는 덮어쓰지 않음
  if (dayTypeMap.has(dateStr)) {
    const existing = dayTypeMap.get(dateStr)!;
    if (existing.type === "지정휴일" || existing.type === "휴가" || existing.type === "개인일정") {
      return; // 제외일 타입이면 덮어쓰지 않음
    }
  }
  // ...
});
```

### 2. 제외일 학원일정 필터링 (`app/(student)/plan/calendar/_utils/timelineUtils.ts`)

**변경 전:**
- 제외일이 있어도 학원일정 슬롯이 생성됨

**변경 후:**
- 제외일인 경우 학원일정 슬롯을 생성하지 않음

```typescript
// 학원일정인 경우 학원일정 매칭
if (slot.type === "학원일정") {
  // 제외일인 경우 학원일정도 표시하지 않음
  if (isExclusionDay) {
    return;
  }
  
  // 학원일정 매칭 로직...
}
```

## ✅ 결과

1. **제외일 타입 표시 정확성**
   - 제외일이 있는 날짜는 항상 제외일 타입으로 표시됨
   - `daily_schedule`의 "학습일" 정보가 제외일을 덮어쓰지 않음

2. **학원일정 필터링**
   - 제외일이 있는 날짜에는 학원일정이 표시되지 않음
   - 제외일에는 모든 학습 관련 일정이 숨겨짐

## 📝 관련 파일

- `lib/date/calendarDayTypes.ts`: 제외일 타입 우선순위 및 매핑 로직
- `app/(student)/plan/calendar/_utils/timelineUtils.ts`: 제외일 학원일정 필터링

## 🔍 테스트 시나리오

1. **제외일 타입 표시 확인**
   - 제외일이 있는 날짜에 "학습일" 배지가 표시되지 않는지 확인
   - 제외일 배지(지정휴일/휴가/개인일정)가 올바르게 표시되는지 확인

2. **학원일정 필터링 확인**
   - 제외일이 있는 날짜에 학원일정이 표시되지 않는지 확인
   - 제외일이 없는 날짜에는 학원일정이 정상적으로 표시되는지 확인

