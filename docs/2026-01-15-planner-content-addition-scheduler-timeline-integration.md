# 플래너 콘텐츠 추가 시 스케줄러 및 타임라인 기능 연계 방법

**작성일**: 2026-01-15  
**목적**: 플래너 생성 후 콘텐츠 추가 시 스케줄러와 타임라인 기능을 활용하는 방법 설계

---

## 📋 목차

1. [현재 상황 분석](#현재-상황-분석)
2. [스케줄러 및 타임라인 기능 개요](#스케줄러-및-타임라인-기능-개요)
3. [연계 방법 설계](#연계-방법-설계)
4. [구현 방안](#구현-방안)
5. [데이터 흐름](#데이터-흐름)
6. [주요 함수 및 타입](#주요-함수-및-타입)

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
if (input.distributionMode === 'period' && input.periodEndDate) {
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
  Map<string, Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string; // HH:mm
    end: string; // HH:mm
    label?: string;
  }>>
  ```
- `dateAvailableTimeRanges`: 날짜별 사용 가능 시간 범위
  ```typescript
  Map<string, Array<{ start: string; end: string }>>
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
  const academySchedules: AcademySchedule[] = (plannerSchedules || []).map(s => ({
    id: s.id,
    student_id: studentId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    subject: s.subject,
    travel_time: s.travel_time,
  }));
  
  // 6. 제외일 변환
  const exclusions: PlanExclusion[] = (plannerExclusions || []).map(e => ({
    id: e.id,
    plan_group_id: null, // 플랜 그룹 생성 후 업데이트
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason,
  }));
  
  // 7. 블록 세트 조회
  const blocks = await getBlockSetForPlanGroup(
    group,
    studentId,
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
    await linkPlannerDataToPlanGroup(
      planGroupId,
      exclusions,
      academySchedules
    );
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
    content_id: flexibleContent.master_book_id || 
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
    undefined, // contentChapterMap
  );
  
  // 7. 플랜 저장
  const { data: savedPlans } = await supabase
    .from("student_plan")
    .insert(
      scheduledPlans.map(plan => ({
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
      createdPlanIds: savedPlans?.map(p => p.id) || [],
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
  const dateTimeSlots = scheduleResult.daily_schedule.reduce(
    (map, daily) => {
      map.set(daily.date, daily.time_slots || []);
      return map;
    },
    new Map<string, TimeSlot[]>()
  );
  
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

## 결론

### 현재 상태

- ❌ 플래너 콘텐츠 추가 시 스케줄러 미활용
- ❌ 타임라인 기능 미활용
- ❌ 플래너의 시간 설정 미활용

### 개선 방향

- ✅ 기존 스케줄러 및 타임라인 기능 재사용
- ✅ 플래너 정보를 플랜 그룹 형식으로 변환
- ✅ Step 2.5 스케줄 생성 후 Best Fit 알고리즘 적용

### 구현 방법

1. **방안 1 (권장)**: 새로운 함수 생성 (`createPlanFromContentWithScheduler`)
2. **방안 2**: 기존 함수 확장 (`createPlanFromContent`에 옵션 추가)

---

**작성자**: AI Assistant  
**검토 필요**: 구현 전 팀 검토 및 우선순위 결정 권장

