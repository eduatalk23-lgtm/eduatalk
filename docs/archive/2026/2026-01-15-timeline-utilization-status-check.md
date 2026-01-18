# 플랜 생성 및 스케줄러 기능 타임라인 활용 상태 점검

**작성일**: 2026-01-15  
**목적**: 플랜 생성 및 스케줄러 기능에서 타임라인이 어떻게 활용되고 있는지 전반적인 상태 점검 및 문서화

---

## 📋 목차

1. [타임라인 타입 정의](#타임라인-타입-정의)
2. [타임라인 생성 함수](#타임라인-생성-함수)
3. [스케줄러에서의 타임라인 활용](#스케줄러에서의-타임라인-활용)
4. [플랜 생성 플로우에서의 타임라인 활용](#플랜-생성-플로우에서의-타임라인-활용)
5. [UI 표시에서의 타임라인 활용](#ui-표시에서의-타임라인-활용)
6. [현재 상태 요약](#현재-상태-요약)
7. [개선 제안](#개선-제안)

---

## 타임라인 타입 정의

### 1. PlanTimeline (플랜 타임라인)

**위치**: `lib/plan/1730TimetableLogic.ts`

```typescript
export type PlanTimeline = {
  plan_id: string;
  date: string;
  time_slots: TimeSlot[];
  total_duration: number; // 분
  split_info?: {
    original_plan_id: string;
    split_order: number;
    total_split_count: number;
  };
};

export type TimeSlot = {
  start: string; // HH:mm
  end: string; // HH:mm
  type: "study" | "self_study";
};
```

**용도**: 플랜 생성 시 제외 시간으로 인한 분할 처리를 포함한 타임라인 구성

**특징**:

- 학습 시간대와 자율 학습 시간대를 구분
- 분할 정보 포함 (제외 시간으로 인해 분할된 경우)

---

### 2. DateTimeSlots (날짜별 시간 타임라인)

**위치**: `lib/plan/scheduler.ts`

```typescript
export type DateTimeSlots = Map<
  string,
  Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string; // HH:mm
    end: string; // HH:mm
    label?: string;
  }>
>;
```

**용도**: Step 2.5 스케줄 결과로 날짜별 시간 타임라인을 저장

**특징**:

- 날짜별로 다양한 타입의 시간 슬롯 관리
- 학습시간, 점심시간, 학원일정, 이동시간, 자율학습 구분

---

### 3. TimelineSlot (UI 표시용 타임슬롯)

**위치**: `app/(student)/plan/calendar/_utils/timelineUtils.ts`

```typescript
export type TimelineSlot = {
  type: TimeSlotType;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
  plans?: PlanWithContent[]; // 학습시간인 경우 플랜 목록
  academy?: AcademySchedule; // 학원일정인 경우
};
```

**용도**: 캘린더 UI에서 날짜별 타임라인 슬롯 표시

**특징**:

- 플랜 정보와 학원일정 정보 포함
- UI 렌더링에 최적화된 구조

---

### 4. DateAvailableTimeRanges (날짜별 사용 가능 시간 범위)

**위치**: `lib/plan/scheduler.ts`

```typescript
export type DateAvailableTimeRanges = Map<
  string,
  Array<{ start: string; end: string }>
>;
```

**용도**: Step 2.5 스케줄 결과로 날짜별 사용 가능 시간 범위 저장

**특징**:

- 날짜별로 여러 시간 범위 지원 (점심시간 제외 등)
- 타임슬롯이 없을 때 fallback으로 사용

---

## 타임라인 생성 함수

### 1. buildPlanTimeline

**위치**: `lib/plan/1730TimetableLogic.ts`

```typescript
export function buildPlanTimeline(
  planDuration: number, // 분
  date: string,
  availableTimeRanges: Array<{ start: string; end: string }>,
  useSelfStudy: boolean = false,
  selfStudyRanges?: Array<{ start: string; end: string }>
): PlanTimeline;
```

**기능**:

- 플랜의 소요시간을 사용 가능한 시간 범위에 배정
- 학습 시간대에 먼저 배정, 부족하면 자율 학습 시간 사용
- 제외 시간으로 인한 분할 정보 생성

**활용 상태**: ✅ 정의되어 있으나 현재 코드베이스에서 직접 호출하는 곳이 없음

**문제점**:

- 함수는 정의되어 있지만 실제로 사용되지 않음
- `SchedulerEngine`에서 직접 시간 배정을 수행하므로 이 함수가 필요 없을 수 있음

---

### 2. buildTimelineSlots

**위치**: `app/(student)/plan/calendar/_utils/timelineUtils.ts`

```typescript
export function buildTimelineSlots(
  dateStr: string,
  dailySchedule: DailyScheduleInfo | null | undefined,
  plans: PlanWithContent[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[]
): TimelineSlot[];
```

**기능**:

- 날짜별 타임라인 슬롯 생성 (UI 표시용)
- `daily_schedule`의 `time_slots`와 플랜, 학원일정을 결합
- 플랜의 시간 정보를 사용하여 타임라인대로 배치
- 제외일 처리 (휴일지정, 기타 제외일 구분)

**활용 상태**: ✅ 활발히 사용 중

**사용 위치**:

- `app/(student)/plan/calendar/_hooks/useTimelineSlots.ts`
- 캘린더 UI에서 날짜별 타임라인 표시

---

## 스케줄러에서의 타임라인 활용

### 1. SchedulerEngine

**위치**: `lib/scheduler/SchedulerEngine.ts`

**타임라인 활용 방식**:

#### a) dateTimeSlots 활용

```typescript
// 학습시간 슬롯 추출
const timeSlots = dateTimeSlots?.get(date) || [];
const studyTimeSlots = timeSlots.filter((slot) => slot.type === "학습시간");
```

**활용 위치**:

- `generateStudyDayPlans`: 학습일 플랜 생성 시 Best Fit 알고리즘으로 슬롯 배정
- `coordinateGlobalDistribution`: 전역 배치 조율 시 날짜별 용량 계산

**알고리즘**:

- **Best Fit**: 남은 시간이 가장 적은 슬롯에 배정 (공간 효율 최대화)
- **First Fit Fallback**: Best Fit 실패 시 첫 번째 사용 가능한 슬롯에 배정

#### b) dateAvailableTimeRanges 활용

```typescript
// 사용 가능한 시간 범위 조회
const availableRanges = dateAvailableTimeRanges?.get(date) || [];
```

**활용 위치**:

- `generateStudyDayPlans`: `dateTimeSlots`가 없을 때 fallback으로 사용
- `generateReviewDayPlans`: 복습일 플랜 생성 시 시간 범위 사용
- `generateAdditionalPeriodReallocationPlans`: 추가 기간 재배치 시 시간 범위 사용

**우선순위**:

1. `dateTimeSlots` (Step 2.5 스케줄 결과) - 우선 사용
2. `dateAvailableTimeRanges` (Step 2.5 스케줄 결과) - fallback
3. 기존 블록 기반 시간 배정 - 최종 fallback

---

### 2. generatePlansFromGroup

**위치**: `lib/plan/scheduler.ts`

**타임라인 활용**:

```typescript
export async function generatePlansFromGroup(
  group: PlanGroup,
  contents: PlanContent[],
  // ...
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots
  // ...
): Promise<ScheduledPlan[]>;
```

**활용 상태**: ✅ 활발히 사용 중

**전달 경로**:

1. `preparePlanGenerationData` → Step 2.5 스케줄 결과 생성
2. `generatePlansFromGroup` → 스케줄러에 전달
3. `SchedulerEngine` → 타임라인 기반 플랜 생성

---

## 플랜 생성 플로우에서의 타임라인 활용

### 1. preparePlanGenerationData

**위치**: `lib/plan/services/preparePlanGenerationData.ts`

**역할**: 플랜 생성에 필요한 데이터 준비

**타임라인 생성 단계**:

```typescript
// 4. 스케줄 계산
const scheduleResult = await scheduleGenerationService
  .generateSchedule
  // ...
  ();

// 5. 날짜별 시간 할당
const dateTimeSlots = scheduleResult.daily_schedule.reduce((map, daily) => {
  map.set(daily.date, daily.time_slots || []);
  return map;
}, new Map<string, TimeSlot[]>());

const dateAvailableTimeRanges = scheduleResult.daily_schedule.reduce(
  (map, daily) => {
    map.set(daily.date, daily.available_time_ranges || []);
    return map;
  },
  new Map<string, Array<{ start: string; end: string }>>()
);
```

**활용 상태**: ✅ 활발히 사용 중

**결과**:

- `dateTimeSlots`: 날짜별 시간 타임라인
- `dateAvailableTimeRanges`: 날짜별 사용 가능 시간 범위

---

### 2. assignPlanTimes

**위치**: `lib/plan/assignPlanTimes.ts`

**역할**: 플랜을 학습시간 슬롯에 배치

**타임라인 활용**:

```typescript
export function assignPlanTimes(
  plans: PlanTimeInput[],
  studyTimeSlots: StudyTimeSlot[],
  contentDurationMap: Map<string, ContentDurationInfo>,
  dayType: string,
  totalStudyHours: number
): PlanTimeSegment[];
```

**알고리즘**:

- **Best Fit**: 소요시간 내림차순 정렬 후 가장 적합한 슬롯에 배정
- **Episode 기반 배정**: 강의 콘텐츠의 경우 episode별 실제 duration 반영
- **Precalculated Time Bypass**: `SchedulerEngine` 결과가 있으면 그대로 사용

**활용 상태**: ✅ 활발히 사용 중

**사용 위치**:

- `PlanPayloadBuilder.buildDatePayloads`: 날짜별 플랜 페이로드 생성 시

---

### 3. PlanPayloadBuilder

**위치**: `lib/domains/plan/services/planPayloadBuilder.ts`

**타임라인 활용**:

```typescript
// 시간 슬롯 정보 가져오기
const timeSlotsForDate = dateTimeSlots.get(date) || [];
const studyTimeSlots = timeSlotsForDate
  .filter((slot) => slot.type === "학습시간")
  .map((slot) => ({ start: slot.start, end: slot.end }))
  .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
```

**활용 상태**: ✅ 활발히 사용 중

**역할**:

- 날짜별 플랜 페이로드 생성 시 타임라인 정보 활용
- `assignPlanTimes`를 호출하여 플랜 시간 배정

---

## UI 표시에서의 타임라인 활용

### 1. useTimelineSlots

**위치**: `app/(student)/plan/calendar/_hooks/useTimelineSlots.ts`

**역할**: 캘린더 UI에서 타임라인 슬롯 생성

**활용**:

- `buildTimelineSlots` 함수 호출
- 날짜별 타임라인 슬롯 생성 및 반환

**활용 상태**: ✅ 활발히 사용 중

---

### 2. 캘린더 컴포넌트

**위치**: `app/(student)/plan/calendar/_components/`

**타임라인 표시**:

- `DayView`: 일별 타임라인 표시
- `WeekView`: 주별 타임라인 표시
- `TimelineItem`: 개별 타임슬롯 표시

**활용 상태**: ✅ 활발히 사용 중

---

## 현재 상태 요약

### ✅ 잘 활용되고 있는 부분

1. **Step 2.5 스케줄 결과 활용**
   - `dateTimeSlots`: 날짜별 시간 타임라인
   - `dateAvailableTimeRanges`: 날짜별 사용 가능 시간 범위
   - `SchedulerEngine`에서 우선적으로 활용

2. **Best Fit 알고리즘**
   - `SchedulerEngine.generateStudyDayPlans`: 학습일 플랜 생성
   - `assignPlanTimes`: 플랜 시간 배정
   - 공간 효율 최대화

3. **UI 표시**
   - `buildTimelineSlots`: 캘린더 타임라인 생성
   - 제외일 처리 포함

4. **Episode 기반 배정**
   - 강의 콘텐츠의 episode별 실제 duration 반영
   - `assignEpisodeBasedTimes` 함수로 분리 처리

---

### ⚠️ 개선이 필요한 부분

1. **buildPlanTimeline 함수 미사용**
   - 함수는 정의되어 있으나 실제로 사용되지 않음
   - `SchedulerEngine`에서 직접 시간 배정을 수행하므로 중복 가능성

2. **타임라인 생성 로직 분산**
   - `buildPlanTimeline`: 플랜 타임라인 생성 (미사용)
   - `buildTimelineSlots`: UI 타임라인 생성 (사용 중)
   - `SchedulerEngine`: 스케줄러 타임라인 활용 (사용 중)
   - 역할이 명확하지 않음

3. **타입 정의 중복**
   - `TimeSlot` (1730TimetableLogic.ts): `{ start, end, type: "study" | "self_study" }`
   - `DateTimeSlots` (scheduler.ts): `{ start, end, type: "학습시간" | ... }`
   - `TimelineSlot` (timelineUtils.ts): `{ start, end, type: TimeSlotType, plans?, academy? }`
   - 통합 필요성 검토

---

## 개선 제안

### 1. buildPlanTimeline 함수 정리

**옵션 A: 제거**

- 현재 사용되지 않으므로 제거 고려
- `SchedulerEngine`에서 직접 처리하므로 중복

**옵션 B: 재활용**

- `SchedulerEngine` 내부에서 사용하도록 리팩토링
- 제외 시간으로 인한 분할 처리 로직 재사용

**권장**: 옵션 A (제거) - 현재 구조에서 불필요

---

### 2. 타입 정의 통합

**현재 문제**:

- 여러 파일에 유사한 타입 정의가 분산되어 있음
- 타입 간 변환이 복잡함

**개선 방안**:

```typescript
// lib/types/plan/timeline.ts (새 파일)
export type TimeSlotBase = {
  start: string; // HH:mm
  end: string; // HH:mm
};

export type TimeSlotType =
  | "학습시간"
  | "점심시간"
  | "학원일정"
  | "이동시간"
  | "자율학습"
  | "study"
  | "self_study";

export type TimeSlot = TimeSlotBase & {
  type: TimeSlotType;
  label?: string;
};

export type TimelineSlot = TimeSlot & {
  plans?: PlanWithContent[];
  academy?: AcademySchedule;
};
```

**장점**:

- 타입 정의 중앙화
- 타입 간 변환 간소화
- 유지보수성 향상

---

### 3. 타임라인 생성 로직 통합

**현재 구조**:

- `buildPlanTimeline`: 플랜 타임라인 생성 (미사용)
- `buildTimelineSlots`: UI 타임라인 생성
- `SchedulerEngine`: 스케줄러 타임라인 활용

**개선 방안**:

- `buildPlanTimeline` 제거 또는 `SchedulerEngine` 내부로 이동
- `buildTimelineSlots`는 UI 전용으로 유지
- 역할 명확화

---

### 4. 문서화 개선

**현재 상태**:

- 타임라인 활용이 여러 파일에 분산되어 있음
- 각 함수의 역할과 관계가 명확하지 않음

**개선 방안**:

- 각 타임라인 관련 함수에 JSDoc 주석 추가
- 타임라인 생성 플로우 다이어그램 작성
- 타입 간 변환 가이드 작성

---

## 결론

### 현재 상태

✅ **잘 작동하는 부분**:

- Step 2.5 스케줄 결과를 활용한 타임라인 기반 플랜 생성
- Best Fit 알고리즘을 통한 효율적인 시간 배정
- UI에서의 타임라인 표시

⚠️ **개선 필요 부분**:

- `buildPlanTimeline` 함수 미사용
- 타입 정의 중복 및 분산
- 타임라인 생성 로직 역할 명확화 필요

### 우선순위

1. **높음**: 타입 정의 통합 (`lib/types/plan/timeline.ts` 생성)
2. **중간**: `buildPlanTimeline` 함수 정리 (제거 또는 재활용 결정)
3. **낮음**: 문서화 개선 (JSDoc 주석 추가)

---

**작성자**: AI Assistant  
**검토 필요**: 타입 정의 통합 및 함수 정리 작업 전 팀 검토 권장
