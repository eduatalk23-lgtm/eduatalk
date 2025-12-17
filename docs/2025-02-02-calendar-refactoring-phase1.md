# 캘린더 UI 개선 및 코드 최적화 - Phase 1 완료

## 작업 일자
2025-02-02

## 작업 개요

캘린더 뷰 컴포넌트(MonthView, WeekView, DayView, DayTimelineModal)에서 중복된 코드를 제거하고 공통 로직을 추출하여 유지보수성을 향상시켰습니다.

## 완료된 작업

### 1. 공통 유틸리티 및 훅 생성

#### 1.1 `useDayTypeStyling` (날짜 타입별 스타일링 로직)

**파일**: `app/(student)/plan/calendar/_hooks/useDayTypeStyling.ts`

**기능**:
- 날짜 타입별 스타일링 정보 계산
- 휴일 여부 판단
- 오늘 날짜 여부 판단
- 배경색, 텍스트색, 배지 클래스 등 스타일 클래스 반환

**사용 위치**:
- `MonthView`
- `WeekView`
- `DayView`
- `DayTimelineModal`

**변경 전**:
```typescript
// 각 컴포넌트에서 반복되는 코드
const dayType = dayTypeInfo?.type || "normal";
const isHoliday = dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정" || dayExclusions.length > 0;
const isTodayDate = isToday(date);
const dayTypeColor = getDayTypeColor(isHoliday ? "지정휴일" : dayType, isTodayDate);
const bgColorClass = `${dayTypeColor.border} ${dayTypeColor.bg}`;
// ...
```

**변경 후**:
```typescript
const {
  bgColorClass,
  textColorClass,
  boldTextColorClass,
  dayTypeBadgeClass,
} = getDayTypeStyling(date, dayTypeInfo, dayExclusions);
```

#### 1.2 `useCalendarData` (날짜별 데이터 그룹화 로직)

**파일**: `app/(student)/plan/calendar/_hooks/useCalendarData.ts`

**기능**:
- 플랜 목록을 날짜별로 그룹화
- 제외일 목록을 날짜별로 그룹화
- 학원 일정을 날짜별로 그룹화 (요일 기반)

**사용 위치**:
- `MonthView`
- `WeekView`

**변경 전**:
```typescript
// 각 컴포넌트에서 반복되는 코드
const plansByDate = useMemo(() => {
  const map = new Map<string, PlanWithContent[]>();
  plans.forEach((plan) => {
    const date = plan.plan_date;
    if (!map.has(date)) {
      map.set(date, []);
    }
    map.get(date)!.push(plan);
  });
  return map;
}, [plans]);

const exclusionsByDate = useMemo(() => {
  // ... 유사한 코드
}, [exclusions]);
```

**변경 후**:
```typescript
const { plansByDate, exclusionsByDate, academySchedulesByDate } = useCalendarData(
  plans,
  exclusions,
  academySchedules,
  weekDays // WeekView의 경우
);
```

#### 1.3 `useTimelineSlots` (타임라인 슬롯 처리 로직)

**파일**: `app/(student)/plan/calendar/_hooks/useTimelineSlots.ts`

**기능**:
- 타임라인 슬롯 생성
- 시간 순서대로 정렬
- `showOnlyStudyTime` 옵션에 따른 필터링

**사용 위치**:
- `MonthView`
- `WeekView`
- `DayView`
- `DayTimelineModal`

**변경 전**:
```typescript
// 각 컴포넌트에서 반복되는 코드
const timelineSlots = buildTimelineSlots(
  dateStr,
  dailySchedule,
  dayPlans,
  dayAcademySchedules,
  dayExclusions
);

const sortedSlots = [...timelineSlots].sort((a, b) => {
  const aStart = timeToMinutes(a.start);
  const bStart = timeToMinutes(b.start);
  return aStart - bStart;
});

const filteredSlots = showOnlyStudyTime
  ? sortedSlots.filter((slot) => slot.type === "학습시간")
  : sortedSlots;
```

**변경 후**:
```typescript
const { filteredSlots } = getTimelineSlots(
  dateStr,
  dailySchedule,
  dayPlans,
  dayAcademySchedules,
  dayExclusions,
  showOnlyStudyTime
);
```

### 2. 컴포넌트 리팩토링

#### 2.1 MonthView 리팩토링

- `getDayTypeStyling` 사용으로 스타일링 로직 단순화
- `useCalendarData` 사용으로 데이터 그룹화 로직 통합
- `getTimelineSlots` 사용으로 타임라인 슬롯 처리 로직 통합

#### 2.2 WeekView 리팩토링

- `getDayTypeStyling` 사용으로 스타일링 로직 단순화
- `useCalendarData` 사용으로 데이터 그룹화 로직 통합
- `getTimelineSlots` 사용으로 타임라인 슬롯 처리 로직 통합

#### 2.3 DayView 리팩토링

- `getDayTypeStyling` 사용으로 스타일링 로직 단순화
- `getTimelineSlots` 사용으로 타임라인 슬롯 처리 로직 통합

#### 2.4 DayTimelineModal 리팩토링

- `getDayTypeStyling` 사용으로 스타일링 로직 단순화
- `getTimelineSlots` 사용으로 타임라인 슬롯 처리 로직 통합

## 기술적 결정 사항

### 훅 vs 유틸리티 함수

초기에는 커스텀 훅으로 구현했지만, React 훅 규칙을 준수하기 위해 일반 유틸리티 함수로 변경했습니다.

**이유**:
- 훅은 컴포넌트 최상위 레벨에서만 호출 가능
- `renderDayCell` 같은 함수 내부에서 호출 불가
- 각 날짜 셀마다 다른 값을 계산해야 하므로 함수 내부 호출 필요

**해결책**:
- `getDayTypeStyling`, `getTimelineSlots`를 일반 함수로 제공
- 필요시 컴포넌트 최상위에서 `useMemo`로 감싸서 메모이제이션

## 코드 개선 효과

1. **중복 코드 제거**: 약 200줄 이상의 중복 코드 제거
2. **유지보수성 향상**: 공통 로직이 한 곳에 집중되어 수정이 용이
3. **일관성 보장**: 모든 뷰에서 동일한 로직 사용으로 버그 발생 가능성 감소
4. **가독성 향상**: 각 컴포넌트의 핵심 로직에 집중 가능

## 다음 단계 (Phase 2)

다음 작업들을 계획하고 있습니다:

1. **성능 최적화**
   - 이벤트 핸들러에 `useCallback` 적용
   - 컴포넌트에 `React.memo` 적용
   - `useMemo` 의존성 배열 최적화

2. **접근성 개선**
   - ARIA 속성 추가
   - 키보드 네비게이션 구현

3. **UI/UX 개선**
   - 애니메이션 및 전환 효과 추가
   - 반응형 디자인 강화

## 참고 파일

- `app/(student)/plan/calendar/_hooks/useDayTypeStyling.ts`
- `app/(student)/plan/calendar/_hooks/useCalendarData.ts`
- `app/(student)/plan/calendar/_hooks/useTimelineSlots.ts`
- `.cursor/plans/ui-46459a53.plan.md` (전체 계획)

