# 플래너 기반 플랜 생성 및 스케줄러·타임라인 기능 종합 분석

**작성일**: 2026-01-15  
**목적**: 플래너 생성 후 콘텐츠 추가 시 스케줄러와 타임라인 기능의 현재 상태, 문제점, 개선 방안을 종합적으로 분석

---

## 📋 목차

1. [개요](#개요)
2. [타임라인 활용 현황 분석](#타임라인-활용-현황-분석)
3. [플래너 콘텐츠 추가 플로우 분석](#플래너-콘텐츠-추가-플로우-분석)
4. [기존 타임라인 고려 여부 점검](#기존-타임라인-고려-여부-점검)
5. [통합 개선 방안](#통합-개선-방안)
6. [구현 로드맵](#구현-로드맵)

---

## 개요

### 배경

플래너(Planner) 생성 후 개별 콘텐츠를 추가할 때, 현재는 스케줄러와 타임라인 기능을 활용하지 못하고 있습니다. 이로 인해:

- 플래너의 시간 설정(학습시간, 자율학습시간 등)이 활용되지 않음
- Best Fit 알고리즘을 통한 효율적인 시간 배정이 이루어지지 않음
- 기존에 생성된 플랜의 타임라인을 고려하지 않아 시간 겹침 발생 가능
- 블록 세트, 학원일정, 제외일 등이 고려되지 않음

### 목표

1. 플래너 콘텐츠 추가 시 스케줄러 기능 활용
2. 타임라인 기반 Best Fit 알고리즘 적용
3. 기존 타임라인을 고려한 빈 시간대 활용
4. 플래너 설정(시간, 블록, 학원일정 등) 상속

---

## 타임라인 활용 현황 분석

### 1. 타임라인 타입 정의 현황

#### 1.1 PlanTimeline (플랜 타임라인)

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

**활용 상태**: ⚠️ **정의되어 있으나 현재 미사용**

**문제점**:
- `buildPlanTimeline` 함수는 정의되어 있으나 실제로 호출되지 않음
- `SchedulerEngine`에서 직접 시간 배정을 수행하므로 중복 가능성

---

#### 1.2 DateTimeSlots (날짜별 시간 타임라인)

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

**활용 상태**: ✅ **활발히 사용 중**

**활용 위치**:
- `SchedulerEngine.generateStudyDayPlans`: Best Fit 알고리즘으로 슬롯 배정
- `generatePlansFromGroup`: 스케줄러에 전달
- `assignPlanTimes`: 플랜 시간 배정

---

#### 1.3 TimelineSlot (UI 표시용 타임슬롯)

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

**활용 상태**: ✅ **활발히 사용 중**

---

#### 1.4 DateAvailableTimeRanges (날짜별 사용 가능 시간 범위)

**위치**: `lib/plan/scheduler.ts`

```typescript
export type DateAvailableTimeRanges = Map<
  string,
  Array<{ start: string; end: string }>
>;
```

**용도**: Step 2.5 스케줄 결과로 날짜별 사용 가능 시간 범위 저장

**활용 상태**: ✅ **활발히 사용 중** (fallback으로 사용)

---

### 2. 타임라인 생성 함수 현황

#### 2.1 buildPlanTimeline

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

**활용 상태**: ⚠️ **정의되어 있으나 현재 미사용**

**문제점**:
- 함수는 정의되어 있지만 실제로 사용되지 않음
- `SchedulerEngine`에서 직접 시간 배정을 수행하므로 이 함수가 필요 없을 수 있음

**권장 조치**: 제거 또는 `SchedulerEngine` 내부로 이동

---

#### 2.2 buildTimelineSlots

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

**활용 상태**: ✅ **활발히 사용 중**

**사용 위치**:
- `app/(student)/plan/calendar/_hooks/useTimelineSlots.ts`
- 캘린더 UI에서 날짜별 타임라인 표시

---

### 3. 스케줄러에서의 타임라인 활용

#### 3.1 SchedulerEngine

**위치**: `lib/scheduler/SchedulerEngine.ts`

**타임라인 활용 방식**:

##### a) dateTimeSlots 활용

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

##### b) dateAvailableTimeRanges 활용

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

#### 3.2 generatePlansFromGroup

**위치**: `lib/plan/scheduler.ts`

**타임라인 활용**:

```typescript
export async function generatePlansFromGroup(
  group: PlanGroup,
  contents: PlanContent[],
  // ...
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  // ...
): Promise<ScheduledPlan[]>;
```

**활용 상태**: ✅ **활발히 사용 중**

**전달 경로**:
1. `preparePlanGenerationData` → Step 2.5 스케줄 결과 생성
2. `generatePlansFromGroup` → 스케줄러에 전달
3. `SchedulerEngine` → 타임라인 기반 플랜 생성

---

### 4. 플랜 생성 플로우에서의 타임라인 활용

#### 4.1 preparePlanGenerationData

**위치**: `lib/plan/services/preparePlanGenerationData.ts`

**역할**: 플랜 생성에 필요한 데이터 준비

**타임라인 생성 단계**:

```typescript
// 4. 스케줄 계산
const scheduleResult = await scheduleGenerationService.generateSchedule(
  // ...
);

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

**활용 상태**: ✅ **활발히 사용 중**

**결과**:
- `dateTimeSlots`: 날짜별 시간 타임라인
- `dateAvailableTimeRanges`: 날짜별 사용 가능 시간 범위

---

#### 4.2 assignPlanTimes

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

**활용 상태**: ✅ **활발히 사용 중**

**사용 위치**:
- `PlanPayloadBuilder.buildDatePayloads`: 날짜별 플랜 페이로드 생성 시

---

### 5. 타임라인 활용 현황 요약

#### ✅ 잘 활용되고 있는 부분

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

#### ⚠️ 개선이 필요한 부분

1. **buildPlanTimeline 함수 미사용**
   - 함수는 정의되어 있으나 실제로 사용되지 않음
   - `SchedulerEngine`에서 직접 시간 배정을 수행하므로 중복 가능성

2. **타입 정의 중복**
   - `TimeSlot` (1730TimetableLogic.ts): `{ start, end, type: "study" | "self_study" }`
   - `DateTimeSlots` (scheduler.ts): `{ start, end, type: "학습시간" | ... }`
   - `TimelineSlot` (timelineUtils.ts): `{ start, end, type: TimeSlotType, plans?, academy? }`
   - 통합 필요성 검토

3. **타임라인 생성 로직 분산**
   - `buildPlanTimeline`: 플랜 타임라인 생성 (미사용)
   - `buildTimelineSlots`: UI 타임라인 생성 (사용 중)
   - `SchedulerEngine`: 스케줄러 타임라인 활용 (사용 중)
   - 역할이 명확하지 않음

---

## 플래너 콘텐츠 추가 플로우 분석

### 1. 현재 콘텐츠 추가 방식

**위치**: `lib/domains/admin-plan/actions/createPlanFromContent.ts`

**현재 구현**:

- `distributionMode`에 따른 단순 배치만 수행
  - `today`: 오늘 날짜에 단일 플랜 추가
  - `weekly`: 주간 Dock에 단일 플랜 추가
  - `period`: 기간에 걸쳐 균등 분배

**현재 코드 예시**:

```typescript
// 단순 분배만 수행
if (input.distributionMode === "period" && input.periodEndDate) {
  const distributedPlans = distributeOverPeriod({
    // ... 단순 날짜별 균등 분배
  });
}
```

**문제점**:

- ❌ 스케줄러 기능 미활용 (1730 타임테이블 등)
- ❌ 타임라인 기능 미활용 (Best Fit 알고리즘 등)
- ❌ 플래너의 시간 설정 미활용 (학습시간, 자율학습시간 등)
- ❌ 블록 세트 정보 미활용
- ❌ 학원일정 및 제외일 고려 없음
- ❌ 기존 타임라인 미고려 (시간 겹침 가능)

---

### 2. 플래너 정보 구조

**위치**: `lib/domains/admin-plan/actions/planners.ts`

**플래너가 보유한 정보**:

- `default_scheduler_type`: 스케줄러 유형 (기본: "1730_timetable")
- `default_scheduler_options`: 스케줄러 옵션 (study_days, review_days 등)
- `study_hours`: 학습 시간 설정
- `self_study_hours`: 자율 학습 시간 설정
- `lunch_time`: 점심 시간 설정
- `block_set_id`: 블록 세트 ID
- `non_study_time_blocks`: 비학습 시간 블록
- `period_start`, `period_end`: 플래너 기간
- `academySchedules`: 학원일정 (관계 데이터)
- `exclusions`: 제외일 (관계 데이터)

---

### 3. 플래너 정보 → 플랜 그룹 변환

**현재 구현**: `createAutoContentPlanGroup`

**위치**: `lib/domains/admin-plan/actions/createAutoContentPlanGroup.ts`

**기능**: 플래너 정보를 상속받아 플랜 그룹 생성

**상속 항목**:

- `scheduler_type`: `planner.default_scheduler_type`
- `scheduler_options`: `planner.default_scheduler_options`
- `block_set_id`: `planner.block_set_id`
- `study_hours`: `planner.study_hours`
- `self_study_hours`: `planner.self_study_hours`
- `lunch_time`: `planner.lunch_time`
- `non_study_time_blocks`: `planner.non_study_time_blocks`

**개선 필요 사항**:

- 학원일정 및 제외일도 플랜 그룹에 연결 필요
- 플래너의 기간 정보 활용

---

## 기존 타임라인 고려 여부 점검

### 1. 현재 상태 분석

#### ❌ 기존 타임라인 미고려

**현재 구현의 문제점**:

1. **SchedulerEngine.generateStudyDayPlans**
   - `slotAvailability`를 초기화할 때 `usedTime: 0`으로 시작
   - 기존에 저장된 플랜의 시간 정보를 조회하지 않음
   - 기존 플랜이 점유한 시간을 고려하지 않음

2. **assignPlanTimes**
   - `slotAvailability`를 초기화할 때 `usedTime: 0`으로 시작
   - 기존 플랜의 시간 정보를 고려하지 않음

3. **generatePlansFromGroup**
   - 기존 플랜을 조회하는 로직이 없음
   - 항상 새로운 플랜만 생성

**결과**:

- 새로운 콘텐츠 추가 시 기존 플랜과 시간이 겹칠 수 있음
- 빈 시간대를 활용하지 못함
- 타임라인 효율성이 떨어짐

---

### 2. 기존 타임라인 고려 기능

#### ✅ AvailabilityService 존재

**위치**: `lib/domains/plan/services/AvailabilityService.ts`

**기능**:

- 기존 플랜을 고려한 가용시간 계산
- 점유 슬롯 추출 및 남은 가용시간 계산
- 새 플랜 배치 가능 여부 확인

**주요 메서드**:

```typescript
calculateAvailabilityWithExistingPlans(
  input: AvailabilityCalculationInput
): AvailabilityWithExistingPlans;

canPlacePlan(
  dailyInfo: DailyAvailabilityInfo,
  durationMinutes: number
): { canPlace: boolean; suggestedSlots: TimeRange[] };

findAvailableSlotsForDuration(
  dailyAvailability: DailyAvailabilityInfo[],
  durationMinutes: number,
  preferredDates?: string[]
): Array<{ date: string; slot: TimeRange }>;
```

**문제점**:

- ❌ 스케줄러 로직에서 사용되지 않음
- ❌ `SchedulerEngine`과 연계되지 않음
- ❌ `assignPlanTimes`와 연계되지 않음

---

## 통합 개선 방안

### 1. 전체 아키텍처

```
[플래너 콘텐츠 추가 요청]
         │
         ▼
[1. 플래너 정보 조회]
  - 스케줄러 설정
  - 시간 설정
  - 블록 세트
  - 학원일정
  - 제외일
         │
         ▼
[2. 플랜 그룹 생성/확인]
  - 플래너 정보 상속
  - 콘텐츠 추가
         │
         ▼
[3. 기존 플랜 조회] ⭐ 새로 추가
  - 플랜 그룹의 기존 플랜 시간 정보 조회
  - 날짜별 그룹화
         │
         ▼
[4. 스케줄 생성 (Step 2.5)]
  - preparePlanGenerationData 유사 로직
  - dateTimeSlots 생성
  - dateAvailableTimeRanges 생성
         │
         ▼
[5. 기존 타임라인 반영] ⭐ 새로 추가
  - 기존 플랜 시간을 dateTimeSlots에서 제외
  - 빈 시간대만 추출
         │
         ▼
[6. 스케줄러로 플랜 생성]
  - generatePlansFromGroup 호출
  - Best Fit 알고리즘 적용 (기존 플랜 고려)
         │
         ▼
[7. 플랜 저장]
  - student_plan 테이블에 저장
```

---

### 2. 구현 방안

#### 방안 1: SchedulerEngine에 기존 플랜 반영 (권장)

**장점**:
- 기존 검증된 로직 재사용
- 유지보수 용이
- 일관성 유지
- 기존 플랜과 겹치지 않음
- 빈 시간대를 효율적으로 활용

**구현 단계**:

##### Step 1: 기존 플랜 조회 함수

```typescript
/**
 * 플랜 그룹의 기존 플랜 조회
 */
async function getExistingPlansForPlanGroup(
  planGroupId: string,
  periodStart: string,
  periodEnd: string
): Promise<
  Array<{
    plan_date: string;
    start_time: string | null;
    end_time: string | null;
    content_type: string;
    content_id: string;
  }>
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("student_plan")
    .select("plan_date, start_time, end_time, content_type, content_id")
    .eq("plan_group_id", planGroupId)
    .gte("plan_date", periodStart)
    .lte("plan_date", periodEnd)
    .not("start_time", "is", null)
    .not("end_time", "is", null)
    .eq("is_active", true)
    .order("plan_date", { ascending: true })
    .order("start_time", { ascending: true });

  return data || [];
}
```

##### Step 2: 플래너 정보를 플랜 그룹 형식으로 변환

```typescript
/**
 * 플래너 정보를 플랜 그룹 형식으로 변환
 */
async function convertPlannerToPlanGroupData(
  plannerId: string,
  tenantId: string,
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<{
  group: PlanGroup;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  blocks: BlockInfo[];
}> {
  const supabase = await createSupabaseServerClient();

  // 1. 플래너 정보 조회
  const { data: planner } = await supabase
    .from("planners")
    .select("*")
    .eq("id", plannerId)
    .single();

  // 2. 학원일정 조회
  const { data: plannerSchedules } = await supabase
    .from("planner_academy_schedules")
    .select("*")
    .eq("planner_id", plannerId);

  // 3. 제외일 조회
  const { data: plannerExclusions } = await supabase
    .from("planner_exclusions")
    .select("*")
    .eq("planner_id", plannerId);

  // 4. 플랜 그룹 형식으로 변환
  const group: PlanGroup = {
    id: crypto.randomUUID(), // 임시 ID (실제로는 생성된 그룹 ID 사용)
    tenant_id: tenantId,
    student_id: studentId,
    name: null,
    scheduler_type: planner.default_scheduler_type || "1730_timetable",
    scheduler_options: planner.default_scheduler_options || {},
    period_start: periodStart,
    period_end: periodEnd,
    target_date: null,
    block_set_id: planner.block_set_id,
    planner_id: plannerId,
    status: "active",
    study_hours: planner.study_hours,
    self_study_hours: planner.self_study_hours,
    lunch_time: planner.lunch_time,
    non_study_time_blocks: planner.non_study_time_blocks,
    // ... 기타 필드
  };

  // 5. 학원일정 변환
  const academySchedules: AcademySchedule[] = (plannerSchedules || []).map(
    (s) => ({
      id: s.id,
      student_id: studentId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      subject: s.subject,
      travel_time: s.travel_time,
    })
  );

  // 6. 제외일 변환
  const exclusions: PlanExclusion[] = (plannerExclusions || []).map((e) => ({
    id: e.id,
    plan_group_id: null, // 플랜 그룹 생성 후 업데이트
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason,
  }));

  // 7. 블록 세트 조회
  const blocks = await getBlockSetForPlanGroup(
    group,
    studentId
    // ... 기타 파라미터
  );

  return { group, exclusions, academySchedules, blocks };
}
```

##### Step 3: 기존 타임라인 반영 로직

```typescript
/**
 * 기존 플랜 시간을 고려한 dateTimeSlots 조정
 */
function adjustDateTimeSlotsWithExistingPlans(
  dateTimeSlots: DateTimeSlots,
  existingPlans: Array<{
    plan_date: string;
    start_time: string;
    end_time: string;
  }>
): DateTimeSlots {
  // 날짜별 기존 플랜 그룹화
  const existingPlansByDate = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  existingPlans.forEach((plan) => {
    if (!existingPlansByDate.has(plan.plan_date)) {
      existingPlansByDate.set(plan.plan_date, []);
    }
    if (plan.start_time && plan.end_time) {
      existingPlansByDate.get(plan.plan_date)!.push({
        start: plan.start_time,
        end: plan.end_time,
      });
    }
  });

  // 기존 플랜 시간을 고려한 dateTimeSlots 생성
  const adjustedDateTimeSlots = new Map<string, Array<TimeSlot>>();

  dateTimeSlots.forEach((slots, date) => {
    const existingPlansForDate = existingPlansByDate.get(date) || [];
    const adjustedSlots: TimeSlot[] = [];

    slots.forEach((slot) => {
      if (slot.type === "학습시간") {
        // 기존 플랜 시간을 제외한 빈 시간대 계산
        let remainingRanges = [{ start: slot.start, end: slot.end }];

        existingPlansForDate.forEach((plan) => {
          remainingRanges = remainingRanges.flatMap((range) =>
            subtractTimeRange(range, { start: plan.start, end: plan.end })
          );
        });

        // 빈 시간대를 새로운 슬롯으로 추가
        remainingRanges.forEach((range) => {
          if (timeToMinutes(range.end) > timeToMinutes(range.start)) {
            adjustedSlots.push({
              type: "학습시간",
              start: range.start,
              end: range.end,
              label: slot.label,
            });
          }
        });
      } else {
        // 학습시간이 아닌 슬롯은 그대로 유지
        adjustedSlots.push(slot);
      }
    });

    adjustedDateTimeSlots.set(date, adjustedSlots);
  });

  return adjustedDateTimeSlots;
}

/**
 * 시간 범위에서 다른 시간 범위를 제외
 */
function subtractTimeRange(
  base: { start: string; end: string },
  exclude: { start: string; end: string }
): Array<{ start: string; end: string }> {
  const baseStart = timeToMinutes(base.start);
  const baseEnd = timeToMinutes(base.end);
  const excludeStart = timeToMinutes(exclude.start);
  const excludeEnd = timeToMinutes(exclude.end);

  // 겹치지 않으면 원본 반환
  if (excludeEnd <= baseStart || excludeStart >= baseEnd) {
    return [base];
  }

  const result: Array<{ start: string; end: string }> = [];

  // 앞부분
  if (baseStart < excludeStart) {
    result.push({
      start: minutesToTime(baseStart),
      end: minutesToTime(excludeStart),
    });
  }

  // 뒷부분
  if (excludeEnd < baseEnd) {
    result.push({
      start: minutesToTime(excludeEnd),
      end: minutesToTime(baseEnd),
    });
  }

  return result;
}
```

##### Step 4: 스케줄러를 활용한 콘텐츠 추가

```typescript
/**
 * 스케줄러를 활용한 콘텐츠 추가 (기존 타임라인 고려)
 */
export async function createPlanFromContentWithScheduler(
  input: CreatePlanFromContentInput
): Promise<AdminPlanResponse<CreatePlanFromContentResult>> {
  const supabase = await createSupabaseServerClient();

  // 1. 플래너 정보를 플랜 그룹 형식으로 변환
  const { group, exclusions, academySchedules, blocks } =
    await convertPlannerToPlanGroupData(
      input.plannerId,
      input.tenantId,
      input.studentId,
      input.targetDate,
      input.periodEndDate || input.targetDate
    );

  // 2. 플랜 그룹 생성 (또는 기존 그룹 사용)
  let planGroupId = input.planGroupId;
  if (!planGroupId) {
    const autoGroupResult = await createAutoContentPlanGroupAction({
      tenantId: input.tenantId,
      studentId: input.studentId,
      plannerId: input.plannerId,
      contentTitle: input.contentTitle,
      targetDate: input.targetDate,
      planPurpose: "content",
    });

    if (!autoGroupResult.success) {
      return { success: false, error: autoGroupResult.error };
    }

    planGroupId = autoGroupResult.groupId;

    // 플랜 그룹에 학원일정 및 제외일 연결
    await linkPlannerDataToPlanGroup(planGroupId, exclusions, academySchedules);
  }

  // 3. 기존 플랜 조회 (기존 타임라인 고려)
  const existingPlans = await getExistingPlansForPlanGroup(
    planGroupId,
    group.period_start,
    group.period_end
  );

  // 4. 콘텐츠 정보 조회
  const { data: flexibleContent } = await supabase
    .from("flexible_contents")
    .select("*")
    .eq("id", input.flexibleContentId)
    .single();

  // 5. PlanContent 형식으로 변환
  const planContent: PlanContent = {
    id: crypto.randomUUID(),
    plan_group_id: planGroupId,
    content_type: flexibleContent.content_type,
    content_id:
      flexibleContent.master_book_id ||
      flexibleContent.master_lecture_id ||
      flexibleContent.master_custom_content_id,
    start_range: input.rangeStart || 1,
    end_range: input.rangeEnd || 100,
    display_order: 0,
  };

  // 6. 스케줄 생성 (preparePlanGenerationData 유사 로직)
  const scheduleResult = await generateScheduleForPlanner({
    group,
    blocks,
    academySchedules,
    exclusions,
  });

  // 7. 기존 타임라인 반영 (기존 플랜 시간 제외)
  const adjustedDateTimeSlots = adjustDateTimeSlotsWithExistingPlans(
    scheduleResult.dateTimeSlots,
    existingPlans.filter(
      (p) => p.start_time !== null && p.end_time !== null
    ) as Array<{ plan_date: string; start_time: string; end_time: string }>
  );

  // 8. 스케줄러로 플랜 생성 (조정된 타임라인 사용)
  const scheduledPlans = await generatePlansFromGroup(
    group,
    [planContent],
    exclusions,
    academySchedules,
    blocks,
    undefined, // contentSubjects
    undefined, // riskIndexMap
    scheduleResult.dateAvailableTimeRanges,
    adjustedDateTimeSlots, // 기존 플랜을 고려한 타임라인
    undefined, // contentDurationMap
    undefined // contentChapterMap
  );

  // 9. 플랜 저장
  const { data: savedPlans } = await supabase
    .from("student_plan")
    .insert(
      scheduledPlans.map((plan) => ({
        student_id: input.studentId,
        tenant_id: input.tenantId,
        plan_group_id: planGroupId,
        plan_date: plan.plan_date,
        block_index: plan.block_index,
        content_type: plan.content_type,
        content_id: plan.content_id,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        start_time: plan.start_time,
        end_time: plan.end_time,
        is_reschedulable: plan.is_reschedulable,
        status: "pending",
        is_active: true,
      }))
    )
    .select("id");

  return {
    success: true,
    data: {
      createdPlanIds: savedPlans?.map((p) => p.id) || [],
      createdCount: savedPlans?.length || 0,
    },
  };
}
```

##### Step 5: 스케줄 생성 함수

```typescript
/**
 * 플래너 기반 스케줄 생성
 */
async function generateScheduleForPlanner(input: {
  group: PlanGroup;
  blocks: BlockInfo[];
  academySchedules: AcademySchedule[];
  exclusions: PlanExclusion[];
}): Promise<{
  dateTimeSlots: DateTimeSlots;
  dateAvailableTimeRanges: DateAvailableTimeRanges;
}> {
  // preparePlanGenerationData의 스케줄 생성 로직 재사용
  const scheduleGenerationService = adaptScheduleGeneration();

  const scheduleResult = await scheduleGenerationService.generateSchedule({
    periodStart: input.group.period_start,
    periodEnd: input.group.period_end,
    blocks: input.blocks,
    academySchedules: input.academySchedules,
    exclusions: input.exclusions,
    studyHours: input.group.study_hours,
    selfStudyHours: input.group.self_study_hours,
    lunchTime: input.group.lunch_time,
    nonStudyTimeBlocks: input.group.non_study_time_blocks,
  });

  // dateTimeSlots 및 dateAvailableTimeRanges 추출
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

  return { dateTimeSlots, dateAvailableTimeRanges };
}
```

---

#### 방안 2: AvailabilityService 활용

**장점**:
- 기존 서비스 재사용
- 로직 분리 및 유지보수 용이
- 테스트 용이

**단점**:
- `AvailabilityService`가 스케줄러와 완전히 통합되지 않음
- 추가 변환 단계 필요

**구현**:

```typescript
/**
 * AvailabilityService를 활용한 기존 타임라인 반영
 */
async function adjustScheduleWithAvailabilityService(
  scheduleResult: ScheduleResult,
  planGroupId: string,
  periodStart: string,
  periodEnd: string
): Promise<{
  dateTimeSlots: DateTimeSlots;
  dateAvailableTimeRanges: DateAvailableTimeRanges;
}> {
  const availabilityService = getAvailabilityService();

  // 기존 플랜 조회
  const existingPlans = await getExistingPlansForPlanGroup(
    planGroupId,
    periodStart,
    periodEnd
  );

  // 가용시간 계산
  const availability =
    availabilityService.calculateAvailabilityWithExistingPlans({
      dailySchedule: scheduleResult.daily_schedule,
      existingPlans: existingPlans.map((plan) => ({
        id: plan.id || crypto.randomUUID(),
        plan_date: plan.plan_date,
        start_time: plan.start_time,
        end_time: plan.end_time,
        content_type: plan.content_type as "book" | "lecture" | "custom",
        content_id: plan.content_id,
      })),
    });

  // 남은 가용시간을 dateTimeSlots로 변환
  const adjustedDateTimeSlots = new Map<string, Array<TimeSlot>>();
  availability.dailyAvailability.forEach((dayInfo) => {
    const slots: TimeSlot[] = dayInfo.remainingRanges.map((range) => ({
      type: "학습시간",
      start: range.start,
      end: range.end,
    }));
    adjustedDateTimeSlots.set(dayInfo.date, slots);
  });

  // dateAvailableTimeRanges도 조정
  const adjustedDateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  availability.dailyAvailability.forEach((dayInfo) => {
    adjustedDateAvailableTimeRanges.set(dayInfo.date, dayInfo.remainingRanges);
  });

  return {
    dateTimeSlots: adjustedDateTimeSlots,
    dateAvailableTimeRanges: adjustedDateAvailableTimeRanges,
  };
}
```

---

### 3. SchedulerEngine 개선 방안

#### 3.1 기존 플랜 정보를 Context에 추가

```typescript
export type SchedulerContext = {
  periodStart: string;
  periodEnd: string;
  exclusions: PlanExclusion[];
  blocks: BlockInfo[];
  academySchedules: AcademySchedule[];
  contents: ContentInfo[];
  options?: SchedulerOptions;
  riskIndexMap?: Map<string, { riskScore: number }>;
  dateAvailableTimeRanges?: DateAvailableTimeRanges;
  dateTimeSlots?: DateTimeSlots;
  contentDurationMap?: ContentDurationMap;
  contentSubjects?: Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >;
  // ⭐ 새로 추가
  existingPlans?: Array<{
    plan_date: string;
    start_time: string;
    end_time: string;
  }>;
};
```

#### 3.2 generateStudyDayPlans에서 기존 플랜 반영

```typescript
private generateStudyDayPlans(
  studyDaysList: string[],
  contents: ContentInfo[],
  rangeMap: Map<string, Map<string, { start: number; end: number }>>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap,
  riskIndexMap?: Map<string, { riskScore: number }>
): {
  plans: ScheduledPlan[];
  studyPlansByDate: Map<
    string,
    Array<{ content: ContentInfo; start: number; end: number }>
  >;
} {
  // ... 기존 로직 ...

  studyPlansByDate.forEach((datePlans, date) => {
    const availableRanges = dateAvailableTimeRanges?.get(date) || [];
    const timeSlots = dateTimeSlots?.get(date) || [];
    const studyTimeSlots = timeSlots.filter(
      (slot) => slot.type === "학습시간"
    );

    // ⭐ 기존 플랜 시간을 slotAvailability에 반영
    const existingPlans = this.context.existingPlans || [];
    const dateExistingPlans = existingPlans.filter(
      (p) => p.plan_date === date
    );

    // 슬롯별 사용 가능한 시간 추적 (기존 플랜 시간 반영)
    const slotAvailability: Array<{
      slot: typeof studyTimeSlots[0];
      usedTime: number;
    }> = studyTimeSlots.map((slot) => {
      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      let usedTime = 0;

      // 해당 날짜의 기존 플랜 확인
      dateExistingPlans.forEach((existingPlan) => {
        const planStart = timeToMinutes(existingPlan.start_time);
        const planEnd = timeToMinutes(existingPlan.end_time);

        // 기존 플랜이 이 슬롯과 겹치는 경우
        if (planStart < slotEnd && planEnd > slotStart) {
          const overlapStart = Math.max(planStart, slotStart);
          const overlapEnd = Math.min(planEnd, slotEnd);
          usedTime += overlapEnd - overlapStart;
        }
      });

      return { slot, usedTime };
    });

    // ... Best Fit 알고리즘 (기존 로직 유지) ...
  });
}
```

---

## 구현 로드맵

### Phase 1: 기본 연계 (필수) - 우선순위: 높음

#### 1.1 플래너 정보 조회 및 변환

- [ ] `convertPlannerToPlanGroupData` 함수 구현
- [ ] 플래너의 학원일정 및 제외일 조회
- [ ] 블록 세트 조회
- [ ] 플랜 그룹 생성 시 플래너 정보 상속

**예상 작업 시간**: 4-6시간

---

#### 1.2 스케줄 생성

- [ ] `generateScheduleForPlanner` 함수 구현
- [ ] Step 2.5 스케줄 결과 생성
- [ ] `dateTimeSlots` 및 `dateAvailableTimeRanges` 추출

**예상 작업 시간**: 3-4시간

---

#### 1.3 스케줄러로 플랜 생성

- [ ] `createPlanFromContentWithScheduler` 함수 구현
- [ ] `generatePlansFromGroup` 호출
- [ ] Best Fit 알고리즘 적용

**예상 작업 시간**: 4-6시간

---

### Phase 2: 기존 타임라인 고려 (필수) - 우선순위: 높음

#### 2.1 기존 플랜 조회

- [ ] `getExistingPlansForPlanGroup` 함수 구현
- [ ] 날짜별 그룹화
- [ ] 성능 최적화 (인덱스 활용, 배치 조회)

**예상 작업 시간**: 2-3시간

---

#### 2.2 기존 타임라인 반영

- [ ] `adjustDateTimeSlotsWithExistingPlans` 함수 구현
- [ ] `subtractTimeRange` 유틸리티 함수 구현
- [ ] 기존 플랜 시간을 `dateTimeSlots`에서 제외

**예상 작업 시간**: 4-6시간

---

#### 2.3 SchedulerEngine 개선

- [ ] `SchedulerContext`에 `existingPlans` 추가
- [ ] `generateStudyDayPlans`에서 기존 플랜 반영
- [ ] `slotAvailability` 초기화 시 기존 플랜 시간 반영

**예상 작업 시간**: 6-8시간

---

### Phase 3: 고급 기능 (선택) - 우선순위: 중간

#### 3.1 콘텐츠 소요시간 정보 활용

- [ ] `contentDurationMap` 생성 및 전달
- [ ] Episode 기반 배정 (강의 콘텐츠)
- [ ] 정확한 소요시간 계산

**예상 작업 시간**: 4-6시간

---

#### 3.2 Risk Index 기반 우선순위 배정

- [ ] Risk Index 조회
- [ ] 취약과목 우선 배정
- [ ] 우선순위 정렬 로직

**예상 작업 시간**: 3-4시간

---

#### 3.3 복습일 자동 생성

- [ ] 1730 타임테이블 복습일 로직 적용
- [ ] 복습 범위 계산
- [ ] 복습 플랜 생성

**예상 작업 시간**: 4-6시간

---

### Phase 4: UI 개선 (선택) - 우선순위: 낮음

#### 4.1 스케줄러 사용 옵션 추가

- [ ] UI에 스케줄러 사용 옵션 추가
- [ ] 기존 타임라인 고려 옵션 추가
- [ ] 설정 저장

**예상 작업 시간**: 3-4시간

---

#### 4.2 미리보기 기능

- [ ] 플랜 생성 전 미리보기
- [ ] 타임라인 시각화
- [ ] 충돌 감지 및 경고

**예상 작업 시간**: 6-8시간

---

#### 4.3 타임라인 시각화

- [ ] 기존 플랜과 새 플랜 구분 표시
- [ ] 빈 시간대 하이라이트
- [ ] 시간 겹침 경고

**예상 작업 시간**: 4-6시간

---

### Phase 5: 코드 정리 (선택) - 우선순위: 낮음

#### 5.1 타입 정의 통합

- [ ] `lib/types/plan/timeline.ts` 생성
- [ ] 타입 정의 중앙화
- [ ] 타입 간 변환 함수 추가

**예상 작업 시간**: 3-4시간

---

#### 5.2 buildPlanTimeline 함수 정리

- [ ] 사용 여부 최종 확인
- [ ] 미사용 시 제거 또는 재활용 결정
- [ ] 문서 업데이트

**예상 작업 시간**: 1-2시간

---

## 성능 최적화 고려사항

### 1. 기존 플랜 조회 최적화

```typescript
// 인덱스 활용
// student_plan 테이블에 (plan_group_id, plan_date, is_active) 복합 인덱스 필요

// 배치 조회
const { data } = await supabase
  .from("student_plan")
  .select("plan_date, start_time, end_time")
  .eq("plan_group_id", planGroupId)
  .gte("plan_date", periodStart)
  .lte("plan_date", periodEnd)
  .not("start_time", "is", null)
  .not("end_time", "is", null)
  .eq("is_active", true);
```

### 2. 날짜별 그룹화 캐싱

```typescript
// 날짜별 그룹화 결과를 Map으로 캐싱
const existingPlansByDate = new Map<string, Array<{ start: string; end: string }>>();
```

### 3. 시간 계산 최적화

```typescript
// timeToMinutes 결과 캐싱
const timeCache = new Map<string, number>();
function getCachedTimeToMinutes(time: string): number {
  if (!timeCache.has(time)) {
    timeCache.set(time, timeToMinutes(time));
  }
  return timeCache.get(time)!;
}
```

---

## 에러 처리 및 예외 상황

### 1. 기존 플랜 조회 실패

```typescript
try {
  const existingPlans = await getExistingPlansForPlanGroup(
    planGroupId,
    periodStart,
    periodEnd
  );
} catch (error) {
  // Fallback: 기존 플랜 없이 진행
  console.warn("기존 플랜 조회 실패, 기존 플랜 없이 진행:", error);
  // 빈 배열로 처리
  const existingPlans: Array<{ plan_date: string; start_time: string; end_time: string }> = [];
}
```

### 2. 시간 겹침 감지

```typescript
// 시간 겹침 감지 및 경고
function detectTimeOverlap(
  newPlan: { start_time: string; end_time: string },
  existingPlans: Array<{ start_time: string; end_time: string }>
): { hasOverlap: boolean; overlappingPlans: Array<{ start: string; end: string }> } {
  const overlaps: Array<{ start: string; end: string }> = [];
  
  existingPlans.forEach(plan => {
    if (timeRangesOverlap(
      { start: newPlan.start_time, end: newPlan.end_time },
      { start: plan.start_time, end: plan.end_time }
    )) {
      overlaps.push({ start: plan.start_time, end: plan.end_time });
    }
  });
  
  return {
    hasOverlap: overlaps.length > 0,
    overlappingPlans: overlaps,
  };
}
```

### 3. 충분한 가용시간 없을 때

```typescript
// 가용시간 부족 감지
if (dayInfo.totalRemainingMinutes < requiredMinutes) {
  this.addFailureReason({
    type: "insufficient_time",
    week: calculateWeekNumber(date, this.context.periodStart),
    dayOfWeek: getDayOfWeekName(new Date(date).getDay()),
    date,
    requiredMinutes,
    availableMinutes: dayInfo.totalRemainingMinutes,
    occupiedMinutes: dayInfo.totalOccupiedMinutes,
  });
}
```

---

## 테스트 전략

### 1. 단위 테스트

```typescript
// getExistingPlansForPlanGroup 테스트
describe("getExistingPlansForPlanGroup", () => {
  it("기존 플랜을 날짜별로 조회해야 함", async () => {
    // ...
  });
  
  it("시간 정보가 없는 플랜은 제외해야 함", async () => {
    // ...
  });
});

// adjustDateTimeSlotsWithExistingPlans 테스트
describe("adjustDateTimeSlotsWithExistingPlans", () => {
  it("기존 플랜 시간을 제외한 빈 시간대를 반환해야 함", () => {
    // ...
  });
  
  it("시간이 겹치는 경우 올바르게 분할해야 함", () => {
    // ...
  });
});
```

### 2. 통합 테스트

```typescript
// createPlanFromContentWithScheduler 통합 테스트
describe("createPlanFromContentWithScheduler", () => {
  it("기존 플랜을 고려하여 새 플랜을 생성해야 함", async () => {
    // ...
  });
  
  it("기존 플랜과 시간이 겹치지 않아야 함", async () => {
    // ...
  });
});
```

### 3. E2E 테스트

```typescript
// 플래너 콘텐츠 추가 E2E 테스트
describe("플래너 콘텐츠 추가 E2E", () => {
  it("플래너 생성 → 콘텐츠 추가 → 타임라인 확인", async () => {
    // ...
  });
});
```

---

## 결론

### 현재 상태 요약

#### ✅ 잘 작동하는 부분

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

#### ❌ 문제점

1. **플래너 콘텐츠 추가 시 스케줄러 미활용**
   - 단순 배치만 수행
   - 플래너의 시간 설정 미활용
   - 블록 세트, 학원일정, 제외일 미고려

2. **기존 타임라인 미고려**
   - 새로운 콘텐츠 추가 시 기존 플랜과 시간 겹침 가능
   - 빈 시간대를 활용하지 못함
   - `AvailabilityService`가 스케줄러와 연계되지 않음

3. **타입 정의 중복**
   - 여러 파일에 유사한 타입 정의가 분산
   - 타입 간 변환이 복잡함

---

### 개선 방향

1. **플래너 정보 활용**
   - 스케줄러 설정 상속
   - 시간 설정 상속 (학습시간, 자율학습시간, 점심시간)
   - 블록 세트, 학원일정, 제외일 활용

2. **스케줄 생성**
   - Step 2.5 스케줄 결과 생성 (`dateTimeSlots`, `dateAvailableTimeRanges`)
   - `preparePlanGenerationData` 로직 재사용

3. **기존 타임라인 고려**
   - 기존 플랜 조회
   - 기존 플랜 시간을 `dateTimeSlots`에서 제외
   - 빈 시간대만 활용

4. **플랜 생성**
   - `generatePlansFromGroup` 활용
   - Best Fit 알고리즘으로 타임라인 기반 배정
   - 학습일/복습일 주기 고려

---

### 구현 우선순위

#### Phase 1 (필수) - 즉시 구현

1. 플래너 정보 조회 및 변환
2. 스케줄 생성
3. 스케줄러로 플랜 생성
4. 기존 플랜 조회
5. 기존 타임라인 반영

**예상 작업 시간**: 20-30시간

#### Phase 2 (선택) - 단기

1. 콘텐츠 소요시간 정보 활용
2. Risk Index 기반 우선순위 배정
3. 복습일 자동 생성

**예상 작업 시간**: 12-16시간

#### Phase 3 (선택) - 중기

1. UI 개선 (스케줄러 옵션, 미리보기)
2. 타입 정의 통합
3. 코드 정리

**예상 작업 시간**: 14-18시간

---

### 권장 구현 방법

**방안 1 (권장)**: 새로운 함수 생성 (`createPlanFromContentWithScheduler`)

- 기존 검증된 로직 재사용
- 유지보수 용이
- 일관성 유지
- 기존 플랜과 겹치지 않음
- 빈 시간대를 효율적으로 활용

**구현 순서**:
1. `getExistingPlansForPlanGroup` 구현
2. `adjustDateTimeSlotsWithExistingPlans` 구현
3. `convertPlannerToPlanGroupData` 구현
4. `generateScheduleForPlanner` 구현
5. `createPlanFromContentWithScheduler` 구현
6. `SchedulerEngine` 개선 (기존 플랜 반영)

---

**작성자**: AI Assistant  
**검토 필요**: 구현 전 팀 검토 및 우선순위 결정 권장  
**최종 업데이트**: 2026-01-15

