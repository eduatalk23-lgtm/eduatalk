# 플래너 콘텐츠 추가 시 스케줄러 및 타임라인 기능 연계 방법

**작성일**: 2026-01-15  
**목적**: 플래너 생성 후 콘텐츠 추가 시 스케줄러와 타임라인 기능을 활용하는 방법 설계

---

## 📋 목차

1. [현재 상황 분석](#현재-상황-분석)
2. [스케줄러 및 타임라인 기능 개요](#스케줄러-및-타임라인-기능-개요)
3. [연계 방법 설계](#연계-방법-설계)
4. [구현 방안](#구현-방안)
5. [기존 타임라인 고려 여부 점검](#기존-타임라인-고려-여부-점검)
6. [데이터 흐름](#데이터-흐름)
7. [주요 함수 및 타입](#주요-함수-및-타입)

---

## 현재 상황 분석

### 1. 현재 콘텐츠 추가 방식

**위치**: `lib/domains/admin-plan/actions/createPlanFromContent.ts`

**현재 구현**:

- `distributionMode`에 따른 단순 배치만 수행
  - `today`: 오늘 날짜에 단일 플랜 추가
  - `weekly`: 주간 Dock에 단일 플랜 추가
  - `period`: 기간에 걸쳐 균등 분배

**문제점**:

- ❌ 스케줄러 기능 미활용 (1730 타임테이블 등)
- ❌ 타임라인 기능 미활용 (Best Fit 알고리즘 등)
- ❌ 플래너의 시간 설정 미활용 (학습시간, 자율학습시간 등)
- ❌ 블록 세트 정보 미활용
- ❌ 학원일정 및 제외일 고려 없음

**현재 코드 예시**:

```typescript
// 단순 분배만 수행
if (input.distributionMode === "period" && input.periodEndDate) {
  const distributedPlans = distributeOverPeriod({
    // ... 단순 날짜별 균등 분배
  });
}
```

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

## 스케줄러 및 타임라인 기능 개요

### 1. 스케줄러 기능

**핵심 함수**: `generatePlansFromGroup`

- **위치**: `lib/plan/scheduler.ts`
- **기능**: 플랜 그룹에서 스케줄러를 활용하여 플랜 생성
- **지원 스케줄러**:
  - `1730_timetable`: 학습일/복습일 주기 기반 스케줄링
  - `default`: 기본 균등 분배

**입력 요구사항**:

- `PlanGroup`: 플랜 그룹 정보
- `PlanContent[]`: 콘텐츠 목록
- `PlanExclusion[]`: 제외일 목록
- `AcademySchedule[]`: 학원일정 목록
- `BlockInfo[]`: 블록 정보
- `dateTimeSlots`: 날짜별 시간 타임라인 (Step 2.5 스케줄 결과)
- `dateAvailableTimeRanges`: 날짜별 사용 가능 시간 범위

---

### 2. 타임라인 기능

**핵심 함수**: `preparePlanGenerationData`

- **위치**: `lib/plan/services/preparePlanGenerationData.ts`
- **기능**: Step 2.5 스케줄 결과 생성 (dateTimeSlots, dateAvailableTimeRanges)

**생성 결과**:

- `dateTimeSlots`: 날짜별 시간 타임라인
  ```typescript
  Map<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string; // HH:mm
      end: string; // HH:mm
      label?: string;
    }>
  >;
  ```
- `dateAvailableTimeRanges`: 날짜별 사용 가능 시간 범위
  ```typescript
  Map<string, Array<{ start: string; end: string }>>;
  ```

**활용**:

- `SchedulerEngine`: Best Fit 알고리즘으로 플랜 배정
- `assignPlanTimes`: 플랜을 학습시간 슬롯에 배치

---

## 연계 방법 설계

### 1. 전체 플로우

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
[3. 스케줄 생성 (Step 2.5)]
  - preparePlanGenerationData 유사 로직
  - dateTimeSlots 생성
  - dateAvailableTimeRanges 생성
         │
         ▼
[4. 스케줄러로 플랜 생성]
  - generatePlansFromGroup 호출
  - Best Fit 알고리즘 적용
         │
         ▼
[5. 플랜 저장]
  - student_plan 테이블에 저장
```

---

### 2. 플래너 정보 → 플랜 그룹 변환

**현재 구현**: `createAutoContentPlanGroup`

- **위치**: `lib/domains/admin-plan/actions/createAutoContentPlanGroup.ts`
- **기능**: 플래너 정보를 상속받아 플랜 그룹 생성

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

### 3. 스케줄 생성 로직

**기존 로직**: `preparePlanGenerationData`

- 플랜 그룹 기반으로 스케줄 생성
- 블록 세트, 학원일정, 제외일 고려

**플래너 기반 스케줄 생성 필요**:

1. 플래너의 학원일정 조회
2. 플래너의 제외일 조회
3. 블록 세트 조회
4. 시간 설정 병합
5. Step 2.5 스케줄 생성

---

## 구현 방안

### 방안 1: 기존 함수 재사용 (권장)

**장점**:

- 기존 검증된 로직 재사용
- 유지보수 용이
- 일관성 유지

**구현 단계**:

#### Step 1: 플래너 정보를 플랜 그룹 형식으로 변환

```typescript
// lib/domains/admin-plan/actions/createPlanFromContentWithScheduler.ts

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

#### Step 2: 스케줄 생성 및 플랜 생성

```typescript
/**
 * 스케줄러를 활용한 콘텐츠 추가
 */
export async function createPlanFromContentWithScheduler(
  input: CreatePlanFromContentInput
): Promise<AdminPlanResponse<CreatePlanFromContentResult>> {
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

  // 3. 콘텐츠 정보 조회
  const { data: flexibleContent } = await supabase
    .from("flexible_contents")
    .select("*")
    .eq("id", input.flexibleContentId)
    .single();

  // 4. PlanContent 형식으로 변환
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

  // 5. 스케줄 생성 (preparePlanGenerationData 유사 로직)
  const scheduleResult = await generateScheduleForPlanner({
    group,
    blocks,
    academySchedules,
    exclusions,
  });

  // 6. 스케줄러로 플랜 생성
  const scheduledPlans = await generatePlansFromGroup(
    group,
    [planContent],
    exclusions,
    academySchedules,
    blocks,
    undefined, // contentSubjects
    undefined, // riskIndexMap
    scheduleResult.dateAvailableTimeRanges,
    scheduleResult.dateTimeSlots,
    undefined, // contentDurationMap
    undefined // contentChapterMap
  );

  // 7. 플랜 저장
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

#### Step 3: 스케줄 생성 함수

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

### 방안 2: 기존 함수 확장

**장점**:

- `createPlanFromContent` 함수에 옵션 추가
- 기존 코드와의 호환성 유지

**구현**:

```typescript
export interface CreatePlanFromContentInput {
  // ... 기존 필드
  useScheduler?: boolean; // 스케줄러 사용 여부
}

export async function createPlanFromContent(
  input: CreatePlanFromContentInput
): Promise<AdminPlanResponse<CreatePlanFromContentResult>> {
  // useScheduler가 true이면 스케줄러 사용
  if (input.useScheduler) {
    return createPlanFromContentWithScheduler(input);
  }

  // 기존 로직 유지
  // ...
}
```

---

## 데이터 흐름

### 1. 플래너 정보 조회

```
planners 테이블
  ├─ default_scheduler_type
  ├─ default_scheduler_options
  ├─ study_hours
  ├─ self_study_hours
  ├─ lunch_time
  ├─ block_set_id
  └─ non_study_time_blocks

planner_academy_schedules 테이블
  └─ 학원일정 정보

planner_exclusions 테이블
  └─ 제외일 정보
```

### 2. 플랜 그룹 생성

```
plan_groups 테이블
  ├─ planner_id (플래너 연결)
  ├─ scheduler_type (플래너에서 상속)
  ├─ scheduler_options (플래너에서 상속)
  ├─ study_hours (플래너에서 상속)
  └─ ... (기타 플래너 설정 상속)
```

### 3. 스케줄 생성

```
Step 2.5 스케줄 생성
  ├─ 블록 세트 기반 시간 슬롯 생성
  ├─ 학원일정 고려
  ├─ 제외일 고려
  └─ 비학습 시간 블록 고려

결과:
  ├─ dateTimeSlots (날짜별 시간 타임라인)
  └─ dateAvailableTimeRanges (날짜별 사용 가능 시간 범위)
```

### 4. 플랜 생성

```
SchedulerEngine
  ├─ Best Fit 알고리즘
  ├─ 타임라인 기반 배정
  └─ 학습일/복습일 주기 고려

결과:
  └─ ScheduledPlan[] (시간이 배정된 플랜 목록)
```

---

## 주요 함수 및 타입

### 1. 새로운 함수

```typescript
// lib/domains/admin-plan/actions/createPlanFromContentWithScheduler.ts

/**
 * 스케줄러를 활용한 콘텐츠 추가
 */
export async function createPlanFromContentWithScheduler(
  input: CreatePlanFromContentInput
): Promise<AdminPlanResponse<CreatePlanFromContentResult>>;

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
}>;

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
}>;
```

### 2. 기존 함수 활용

- `generatePlansFromGroup`: 스케줄러로 플랜 생성
- `preparePlanGenerationData`: 스케줄 생성 로직 참고
- `createAutoContentPlanGroup`: 플랜 그룹 생성
- `getBlockSetForPlanGroup`: 블록 세트 조회

---

## 구현 우선순위

### Phase 1: 기본 연계 (필수)

1. ✅ 플래너 정보 조회 및 변환
2. ✅ 플랜 그룹 생성 (플래너 정보 상속)
3. ✅ 스케줄 생성 (Step 2.5)
4. ✅ 스케줄러로 플랜 생성

### Phase 2: 고급 기능 (선택)

1. 콘텐츠 소요시간 정보 활용
2. Risk Index 기반 우선순위 배정
3. Episode 기반 배정 (강의 콘텐츠)
4. 복습일 자동 생성

### Phase 3: UI 개선 (선택)

1. 스케줄러 사용 옵션 추가
2. 미리보기 기능
3. 타임라인 시각화

---

## 기존 타임라인 고려 여부 점검

### 현재 상태 분석

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

### 기존 타임라인 고려 기능

#### ✅ AvailabilityService 존재

**위치**: `lib/domains/plan/services/AvailabilityService.ts`

**기능**:

- 기존 플랜을 고려한 가용시간 계산
- 점유 슬롯 추출 및 남은 가용시간 계산
- 새 플랜 배치 가능 여부 확인

**주요 메서드**:

```typescript
calculateAvailabilityWithExistingPlans(input: AvailabilityCalculationInput): AvailabilityWithExistingPlans
canPlacePlan(dailyInfo: DailyAvailabilityInfo, durationMinutes: number): { canPlace: boolean; suggestedSlots: TimeRange[] }
findAvailableSlotsForDuration(dailyAvailability: DailyAvailabilityInfo[], durationMinutes: number): Array<{ date: string; slot: TimeRange }>
```

**문제점**:

- ❌ 스케줄러 로직에서 사용되지 않음
- ❌ `SchedulerEngine`과 연계되지 않음
- ❌ `assignPlanTimes`와 연계되지 않음

---

### 기존 타임라인 고려 구현 방안

#### 방안 1: SchedulerEngine에 기존 플랜 반영 (권장)

**구현 단계**:

1. **기존 플랜 조회**

   ```typescript
   async function getExistingPlansForPlanGroup(
     planGroupId: string,
     periodStart: string,
     periodEnd: string
   ): Promise<
     Array<{
       plan_date: string;
       start_time: string | null;
       end_time: string | null;
     }>
   > {
     const supabase = await createSupabaseServerClient();
     const { data } = await supabase
       .from("student_plan")
       .select("plan_date, start_time, end_time")
       .eq("plan_group_id", planGroupId)
       .gte("plan_date", periodStart)
       .lte("plan_date", periodEnd)
       .not("start_time", "is", null)
       .not("end_time", "is", null)
       .eq("is_active", true);

     return data || [];
   }
   ```

2. **기존 플랜 시간을 slotAvailability에 반영**

   ```typescript
   // SchedulerEngine.generateStudyDayPlans 내부
   const existingPlans = await getExistingPlansForPlanGroup(
     group.id,
     periodStart,
     periodEnd
   );

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

   // slotAvailability 초기화 시 기존 플랜 시간 반영
   const slotAvailability: Array<{
     slot: (typeof studyTimeSlots)[0];
     usedTime: number;
   }> = studyTimeSlots.map((slot) => {
     const slotStart = timeToMinutes(slot.start);
     const slotEnd = timeToMinutes(slot.end);
     let usedTime = 0;

     // 해당 날짜의 기존 플랜 확인
     const dateExistingPlans = existingPlansByDate.get(date) || [];
     dateExistingPlans.forEach((existingPlan) => {
       const planStart = timeToMinutes(existingPlan.start);
       const planEnd = timeToMinutes(existingPlan.end);

       // 기존 플랜이 이 슬롯과 겹치는 경우
       if (planStart < slotEnd && planEnd > slotStart) {
         const overlapStart = Math.max(planStart, slotStart);
         const overlapEnd = Math.min(planEnd, slotEnd);
         usedTime += overlapEnd - overlapStart;
       }
     });

     return { slot, usedTime };
   });
   ```

3. **dateTimeSlots에서 기존 플랜 시간 제외**

   ```typescript
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
   ```

**장점**:

- 기존 플랜과 겹치지 않음
- 빈 시간대를 효율적으로 활용
- 타임라인 효율성 향상

**단점**:

- 기존 플랜 조회 추가 (성능 고려 필요)
- 로직 복잡도 증가

---

#### 방안 2: AvailabilityService 활용

**구현 단계**:

1. **AvailabilityService로 가용시간 계산**

   ```typescript
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
         id: plan.id,
         plan_date: plan.plan_date,
         start_time: plan.start_time,
         end_time: plan.end_time,
         content_type: plan.content_type,
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
   ```

2. **조정된 dateTimeSlots를 스케줄러에 전달**
   ```typescript
   const scheduledPlans = await generatePlansFromGroup(
     group,
     [planContent],
     exclusions,
     academySchedules,
     blocks,
     undefined,
     undefined,
     undefined, // dateAvailableTimeRanges는 사용하지 않음
     adjustedDateTimeSlots, // 기존 플랜을 고려한 타임라인
     contentDurationMap
   );
   ```

**장점**:

- 기존 서비스 재사용
- 로직 분리 및 유지보수 용이
- 테스트 용이

**단점**:

- `AvailabilityService`가 스케줄러와 완전히 통합되지 않음
- 추가 변환 단계 필요

---

### 구현 권장 사항

#### 1. 단계적 구현

**Phase 1: 기존 플랜 조회 및 반영**

- 플랜 그룹의 기존 플랜 조회 함수 추가
- `SchedulerEngine`에 기존 플랜 정보 전달

**Phase 2: slotAvailability 초기화 개선**

- 기존 플랜 시간을 `slotAvailability`에 반영
- 빈 시간대만 활용하도록 수정

**Phase 3: dateTimeSlots 조정**

- 기존 플랜 시간을 제외한 `dateTimeSlots` 생성
- `AvailabilityService` 활용 검토

#### 2. 성능 최적화

- 기존 플랜 조회 시 인덱스 활용
- 날짜별 그룹화 캐싱
- 배치 조회 최적화

#### 3. 에러 처리

- 기존 플랜 조회 실패 시 fallback
- 시간 겹침 감지 및 경고
- 충분한 가용시간 없을 때 에러 처리

---

## 결론

### 현재 상태

- ❌ 플래너 콘텐츠 추가 시 스케줄러 미활용
- ❌ 타임라인 기능 미활용
- ❌ 플래너의 시간 설정 미활용
- ❌ **기존 타임라인 미고려** ⚠️

### 개선 방향

- ✅ 기존 스케줄러 및 타임라인 기능 재사용
- ✅ 플래너 정보를 플랜 그룹 형식으로 변환
- ✅ Step 2.5 스케줄 생성 후 Best Fit 알고리즘 적용
- ✅ **기존 플랜 시간을 고려한 빈 시간대 활용** ⚠️ (새로 추가)

### 구현 방법

1. **방안 1 (권장)**: 새로운 함수 생성 (`createPlanFromContentWithScheduler`)
   - 기존 플랜 조회 및 반영 로직 포함
   - `SchedulerEngine`에 기존 플랜 정보 전달

2. **방안 2**: 기존 함수 확장 (`createPlanFromContent`에 옵션 추가)
   - `useScheduler` 옵션 추가
   - 기존 타임라인 고려 옵션 추가

### 기존 타임라인 고려 구현

1. **기존 플랜 조회**: 플랜 그룹의 기존 플랜 시간 정보 조회
2. **slotAvailability 초기화**: 기존 플랜 시간을 반영하여 초기화
3. **dateTimeSlots 조정**: 기존 플랜 시간을 제외한 빈 시간대만 사용
4. **AvailabilityService 활용**: 기존 서비스 재사용 검토

---

**작성자**: AI Assistant  
**검토 필요**: 구현 전 팀 검토 및 우선순위 결정 권장  
**업데이트**: 2026-01-15 - 기존 타임라인 고려 여부 점검 추가
