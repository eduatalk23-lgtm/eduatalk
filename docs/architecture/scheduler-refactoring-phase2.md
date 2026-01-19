# 스케줄러 리팩토링 상세 설계 (Phase 2)

> **작성일**: 2026-01-19
> **상태**: 설계 완료, 구현 대기
> **선행 조건**: Phase 1 마이그레이션 완료
> **관련 문서**: [plan-system-unification.md](./plan-system-unification.md)

---

## 목차

1. [개요](#1-개요)
2. [현재 스케줄러 구조](#2-현재-스케줄러-구조)
3. [목표 구조](#3-목표-구조)
4. [상세 변경 계획](#4-상세-변경-계획)
5. [타입 정의](#5-타입-정의)
6. [어댑터 패턴](#6-어댑터-패턴)
7. [테스트 계획](#7-테스트-계획)
8. [구현 체크리스트](#8-구현-체크리스트)

---

## 1. 개요

### 1.1 목표

스케줄러의 조율 책임을 `plan_group → planner`로 이동하여:
- 단일 콘텐츠 PlanGroup 구조 지원
- Planner가 여러 PlanGroup을 함께 조율
- 기존 레거시 코드 하위 호환성 유지

### 1.2 핵심 변경

```
현재:
generatePlansFromGroup(planGroup, contents[]) → ScheduledPlan[]
                       ↑ 여러 콘텐츠 조율

변경 후:
generatePlansFromPlanner(planner, planGroups[]) → ScheduledPlan[]
                         ↑ 여러 PlanGroup 조율 (각 PlanGroup은 단일 콘텐츠)
```

---

## 2. 현재 스케줄러 구조

### 2.1 핵심 파일

| 파일 | 역할 |
|------|------|
| `lib/plan/scheduler.ts` | 메인 진입점, 플랜 생성 오케스트레이션 |
| `lib/plan/1730TimetableLogic.ts` | 6+1 학습/복습 주기 로직 |
| `lib/domains/plan/services/adaptiveScheduler.ts` | 적응형 스케줄러 |
| `lib/plan/generators/planDataPreparer.ts` | 플랜 데이터 준비 |

### 2.2 현재 함수 시그니처

```typescript
// lib/plan/scheduler.ts
export function generatePlansFromGroup(
  planGroup: PlanGroup,
  contents: PlanContent[],
  exclusions: PlanExclusion[],
  blocks: BlockInfo[],
  options?: GeneratePlansOptions
): ScheduledPlan[]
```

### 2.3 현재 데이터 흐름

```
PlanGroup
├─ period_start, period_end
├─ scheduler_type: "1730_timetable" | "default"
├─ scheduler_options: SchedulerOptions
│   ├─ study_days: 6
│   ├─ review_days: 1
│   ├─ subject_allocations: SubjectAllocation[]
│   └─ content_allocations: ContentAllocation[]
│
└─ plan_contents: PlanContent[] (1:N)
    ├─ content_id, content_type
    ├─ start_range, end_range
    └─ display_order

↓ generatePlansFromGroup()

ScheduledPlan[]
├─ plan_date
├─ content_id
├─ planned_start_page_or_time
├─ planned_end_page_or_time
├─ start_time, end_time
├─ date_type: "study" | "review" | "additional_review"
└─ cycle_day_number
```

### 2.4 여러 콘텐츠 조율 로직 (핵심)

```typescript
// lib/plan/1730TimetableLogic.ts

// 1. 전략/취약 과목 날짜 배정
calculateSubjectAllocationDates(cycleDays, allocation)
// - weakness: 모든 학습일
// - strategy: 주당 N일만 선택

// 2. 콘텐츠별 배정 날짜 계산
calculateContentAllocationDates(cycleDays, allocation)
// - 과목 기반 또는 콘텐츠별 커스텀 설정

// 3. 범위 분할
divideContentRange(totalRange, allocatedDates)
// - 각 날짜에 학습할 범위 계산

// 4. 복습일 시간 조율
calculateReviewDuration(studyPlans, reviewCoefficient)
// - 복습 시간 = 학습 시간 × 복습계수
// - 여러 콘텐츠의 복습을 함께 고려
```

---

## 3. 목표 구조

### 3.1 새로운 함수 시그니처

```typescript
// lib/plan/scheduler.ts (신규)

/**
 * Planner 단위로 플랜 생성
 * - 여러 PlanGroup (각각 단일 콘텐츠)을 함께 조율
 * - Planner.schedulerOptions로 조율 정보 관리
 */
export function generatePlansFromPlanner(
  planner: PlannerWithSchedulerOptions,
  planGroups: SingleContentPlanGroup[],
  exclusions: PlanExclusion[],
  blocks: BlockInfo[],
  options?: GeneratePlansOptions
): ScheduledPlan[]
```

### 3.2 새로운 데이터 흐름

```
Planner
├─ period_start, period_end
├─ default_scheduler_type: "1730_timetable" | "default"
├─ scheduler_options: SchedulerOptions (NEW - 조율 정보)
│   ├─ study_days: 6
│   ├─ review_days: 1
│   ├─ subject_allocations: SubjectAllocation[]
│   └─ content_allocations: ContentAllocation[]
│
└─ plan_groups: PlanGroup[] (1:N, 각각 단일 콘텐츠)
    ├─ [0] PlanGroup A (is_single_content=true)
    │   ├─ content_type, content_id
    │   ├─ start_range, end_range
    │   └─ study_type: "weakness" | "strategy"
    │
    ├─ [1] PlanGroup B (is_single_content=true)
    │   └─ ...
    │
    └─ [2] PlanGroup C (is_single_content=true)
        └─ ...

↓ generatePlansFromPlanner()

ScheduledPlan[]
├─ plan_group_id (NEW - 어떤 PlanGroup에서 생성되었는지)
├─ plan_date
├─ content_id
├─ planned_start_page_or_time
├─ planned_end_page_or_time
├─ start_time, end_time
├─ date_type
└─ cycle_day_number
```

---

## 4. 상세 변경 계획

### 4.1 scheduler.ts 변경

#### (1) 신규 함수 추가

```typescript
// lib/plan/scheduler.ts

/**
 * [NEW] Planner 단위로 플랜 생성 (단일 콘텐츠 모드)
 */
export function generatePlansFromPlanner(
  planner: PlannerWithSchedulerOptions,
  planGroups: SingleContentPlanGroup[],
  exclusions: PlanExclusion[],
  blocks: BlockInfo[],
  options?: GeneratePlansOptions
): ScheduledPlan[] {
  // 1. 입력 검증
  validatePlannerInput(planner, planGroups);

  // 2. PlanGroup을 ContentInfo[]로 변환
  const contents = planGroups.map(planGroupToContentInfo);

  // 3. 조율된 scheduler_options 사용 (planner에서)
  const schedulerOptions = planner.schedulerOptions;

  // 4. 내부적으로 기존 로직 재사용
  return generatePlansInternal({
    periodStart: planner.periodStart,
    periodEnd: planner.periodEnd,
    schedulerType: planner.defaultSchedulerType,
    schedulerOptions,
    contents,
    exclusions,
    blocks,
    options,
    planGroupIdMap: buildPlanGroupIdMap(planGroups), // NEW: 결과에 plan_group_id 매핑
  });
}

/**
 * [NEW] PlanGroup → ContentInfo 변환
 */
function planGroupToContentInfo(planGroup: SingleContentPlanGroup): ContentInfo {
  return {
    content_id: planGroup.content_id!,
    content_type: planGroup.content_type!,
    master_content_id: planGroup.master_content_id,
    start_range: planGroup.start_range!,
    end_range: planGroup.end_range!,
    start_detail_id: planGroup.start_detail_id,
    end_detail_id: planGroup.end_detail_id,
    // 추가 메타데이터
    plan_group_id: planGroup.id,
    study_type: planGroup.study_type,
  };
}
```

#### (2) 기존 함수 리팩토링

```typescript
// 기존 generatePlansFromGroup → generatePlansInternal로 내부 로직 분리

// 기존 (유지 - 하위 호환성)
export function generatePlansFromGroup(...): ScheduledPlan[] {
  // 어댑터로 새 함수 호출
  return generatePlansFromGroupAdapter(...);
}

// 신규 (내부 공통 로직)
function generatePlansInternal(params: InternalGenerateParams): ScheduledPlan[] {
  // 기존 로직 대부분 여기로 이동
  // ...
}
```

### 4.2 1730TimetableLogic.ts 변경

#### (1) 조율 로직 분리

```typescript
// lib/plan/1730TimetableLogic.ts

/**
 * [MODIFIED] 콘텐츠별 배정 날짜 계산
 * - 기존: plan_group.scheduler_options 참조
 * - 변경: 외부에서 주입받은 schedulerOptions 사용
 */
export function calculateContentAllocationDates(
  cycleDays: CycleDayInfo[],
  contentInfo: ContentInfo,
  schedulerOptions: SchedulerOptions // <- 외부 주입
): string[] {
  const { content_allocations, subject_allocations } = schedulerOptions;

  // 콘텐츠별 설정 확인
  const contentAlloc = content_allocations?.find(
    a => a.content_id === contentInfo.content_id
  );

  if (contentAlloc) {
    return calculateFromContentAllocation(cycleDays, contentAlloc);
  }

  // 과목 기반 설정 확인
  const subjectAlloc = subject_allocations?.find(
    a => a.subject_name === contentInfo.subject_name
  );

  if (subjectAlloc) {
    return calculateFromSubjectAllocation(cycleDays, subjectAlloc);
  }

  // 기본값: 모든 학습일
  return cycleDays
    .filter(d => d.day_type === "study")
    .map(d => d.date);
}
```

#### (2) 복습일 조율 (여러 콘텐츠)

```typescript
/**
 * [MODIFIED] 복습일 시간 조율
 * - 모든 콘텐츠의 복습을 한 날짜에 함께 고려
 * - 블록 시간 내에 맞추기 위해 조율
 */
export function calculateReviewDurations(
  contentPlans: Map<string, StudyPlan[]>,  // content_id -> 학습 플랜
  reviewDate: string,
  blockDuration: number, // 해당 날짜 블록 총 시간 (분)
  reviewCoefficient: number = 0.4
): Map<string, number> {
  // 1. 각 콘텐츠의 기본 복습 시간 계산
  const baseDurations = new Map<string, number>();
  for (const [contentId, plans] of contentPlans) {
    const totalStudyTime = plans.reduce((sum, p) => sum + p.duration, 0);
    baseDurations.set(contentId, totalStudyTime * reviewCoefficient);
  }

  // 2. 총 복습 시간이 블록 초과하면 비율 조정
  const totalReviewTime = Array.from(baseDurations.values())
    .reduce((sum, d) => sum + d, 0);

  if (totalReviewTime > blockDuration) {
    const ratio = blockDuration / totalReviewTime;
    for (const [contentId, duration] of baseDurations) {
      baseDurations.set(contentId, Math.floor(duration * ratio));
    }
  }

  return baseDurations;
}
```

### 4.3 adaptiveScheduler.ts 변경

```typescript
// lib/domains/plan/services/adaptiveScheduler.ts

/**
 * [MODIFIED] 적응형 스케줄러
 * - Planner 단위 입력 지원
 */
export async function adaptiveSchedule(
  input: AdaptiveSchedulerInput
): Promise<AdaptiveSchedulerResult> {
  // Planner 모드 (신규)
  if (input.planner && input.planGroups) {
    return adaptiveScheduleFromPlanner(input);
  }

  // PlanGroup 모드 (기존 - 하위 호환성)
  if (input.planGroup && input.contents) {
    return adaptiveScheduleFromPlanGroup(input);
  }

  throw new Error("Invalid input: either (planner, planGroups) or (planGroup, contents) required");
}
```

---

## 5. 타입 정의

### 5.1 신규 타입

```typescript
// lib/types/plan/scheduler.ts (신규 파일)

/**
 * Planner + SchedulerOptions 통합 타입
 */
export interface PlannerWithSchedulerOptions {
  id: string;
  tenantId: string;
  studentId: string;
  periodStart: string;
  periodEnd: string;
  defaultSchedulerType: SchedulerType;
  schedulerOptions: SchedulerOptions;
  studyHours: TimeRange | null;
  selfStudyHours: TimeRange | null;
  lunchTime: TimeRange | null;
  blockSetId: string | null;
}

/**
 * 단일 콘텐츠 PlanGroup
 */
export interface SingleContentPlanGroup {
  id: string;
  plannerId: string;
  // 단일 콘텐츠 필드 (필수)
  contentType: string;
  contentId: string;
  masterContentId?: string | null;
  startRange: number;
  endRange: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  // 학습 유형
  studyType?: "strategy" | "weakness";
  strategyDaysPerWeek?: number;
  // is_single_content = true 보장됨
}

/**
 * 스케줄러 내부 입력 파라미터
 */
export interface InternalGenerateParams {
  periodStart: string;
  periodEnd: string;
  schedulerType: SchedulerType;
  schedulerOptions: SchedulerOptions;
  contents: ContentInfo[];
  exclusions: PlanExclusion[];
  blocks: BlockInfo[];
  options?: GeneratePlansOptions;
  // 결과 매핑용
  planGroupIdMap?: Map<string, string>; // content_id -> plan_group_id
}

/**
 * 확장된 ContentInfo (plan_group_id 포함)
 */
export interface ContentInfoWithPlanGroup extends ContentInfo {
  plan_group_id: string;
  study_type?: "strategy" | "weakness";
}
```

### 5.2 기존 타입 확장

```typescript
// lib/types/plan/domain.ts 에 추가

/**
 * ScheduledPlan 확장 (plan_group_id 추가)
 */
export interface ScheduledPlanWithGroup extends ScheduledPlan {
  /** 생성된 PlanGroup ID (단일 콘텐츠 모드) */
  plan_group_id?: string;
}
```

---

## 6. 어댑터 패턴

### 6.1 기존 호출부 어댑터

```typescript
// lib/plan/adapters/legacyAdapter.ts (신규 파일)

/**
 * 기존 generatePlansFromGroup 호출부 어댑터
 *
 * 기존:
 *   generatePlansFromGroup(planGroup, contents, ...)
 *
 * 변경 후:
 *   generatePlansFromGroupAdapter(planGroup, contents, ...)
 *   → 내부적으로 PlanGroup을 Planner 구조로 변환
 *   → generatePlansFromPlanner 호출
 */
export function generatePlansFromGroupAdapter(
  planGroup: PlanGroup,
  contents: PlanContent[],
  exclusions: PlanExclusion[],
  blocks: BlockInfo[],
  options?: GeneratePlansOptions
): ScheduledPlan[] {
  // 1. PlanGroup에서 가상 Planner 생성
  const virtualPlanner: PlannerWithSchedulerOptions = {
    id: `virtual-planner-${planGroup.id}`,
    tenantId: planGroup.tenant_id,
    studentId: planGroup.student_id,
    periodStart: planGroup.period_start,
    periodEnd: planGroup.period_end,
    defaultSchedulerType: planGroup.scheduler_type || "1730_timetable",
    schedulerOptions: planGroup.scheduler_options || {},
    studyHours: planGroup.study_hours || null,
    selfStudyHours: planGroup.self_study_hours || null,
    lunchTime: planGroup.lunch_time || null,
    blockSetId: planGroup.block_set_id,
  };

  // 2. PlanContent[] → SingleContentPlanGroup[] 변환
  const singleContentGroups: SingleContentPlanGroup[] = contents.map((content, index) => ({
    id: `virtual-group-${planGroup.id}-${index}`,
    plannerId: virtualPlanner.id,
    contentType: content.content_type,
    contentId: content.content_id,
    masterContentId: content.master_content_id,
    startRange: content.start_range,
    endRange: content.end_range,
    startDetailId: content.start_detail_id,
    endDetailId: content.end_detail_id,
  }));

  // 3. 새 함수 호출
  const results = generatePlansFromPlanner(
    virtualPlanner,
    singleContentGroups,
    exclusions,
    blocks,
    options
  );

  // 4. 결과에서 plan_group_id 제거 (기존 호환성)
  return results.map(plan => {
    const { plan_group_id, ...rest } = plan as ScheduledPlanWithGroup;
    return rest as ScheduledPlan;
  });
}
```

### 6.2 호출부 마이그레이션 가이드

```typescript
// Before (Phase 3 이전)
const plans = generatePlansFromGroup(
  planGroup,
  planContents,
  exclusions,
  blocks
);

// After (Phase 3 이후)
const plans = generatePlansFromPlanner(
  planner,
  planGroups, // 각 PlanGroup은 단일 콘텐츠
  exclusions,
  blocks
);
```

---

## 7. 테스트 계획

### 7.1 단위 테스트

```typescript
// tests/unit/plan/scheduler.test.ts

describe("generatePlansFromPlanner", () => {
  describe("블록 효율성", () => {
    it("여러 콘텐츠가 같은 블록을 공유해야 함", () => {
      // 180분 블록에 3개 콘텐츠 (수학 30분, 국어 90분, 영어 60분)
      // 총 180분 = 100% 효율
    });

    it("단일 콘텐츠도 정상 동작해야 함", () => {
      // 1개 콘텐츠만 있을 때도 정상 작동
    });
  });

  describe("전략/취약 과목 배정", () => {
    it("취약과목은 모든 학습일에 배정", () => {
      // 6일/주 × 4주 = 24일
    });

    it("전략과목은 지정된 일수만 배정", () => {
      // 3일/주 × 4주 = 12일
    });
  });

  describe("복습일 조율", () => {
    it("모든 콘텐츠의 복습이 한 날짜에 조율됨", () => {
      // 복습일: 수학 + 국어 + 영어 복습 합계 <= 블록 시간
    });

    it("복습의 복습(additional_period)도 정상 작동", () => {
      // 추가 기간에서 복습의 복습 생성
    });
  });
});

describe("generatePlansFromGroupAdapter (하위 호환성)", () => {
  it("기존 호출 방식으로도 동일한 결과 생성", () => {
    // 기존 입력 → 어댑터 → 새 함수 → 기존과 동일한 결과
  });
});
```

### 7.2 통합 테스트

```typescript
// tests/integration/plan/scheduler-integration.test.ts

describe("스케줄러 통합 테스트", () => {
  it("Planner + 여러 PlanGroup으로 플랜 생성", async () => {
    // 1. Planner 생성 (schedulerOptions 포함)
    // 2. 3개 PlanGroup 생성 (각각 단일 콘텐츠)
    // 3. generatePlansFromPlanner 호출
    // 4. 결과 검증:
    //    - plan_group_id가 올바르게 매핑됨
    //    - 블록 효율성 100%
    //    - 복습일 시간 조율됨
  });

  it("기존 PlanGroup + plan_contents로도 플랜 생성 (하위 호환)", async () => {
    // 1. 기존 방식으로 PlanGroup + plan_contents 생성
    // 2. generatePlansFromGroup 호출
    // 3. 결과가 기존과 동일함
  });
});
```

### 7.3 E2E 테스트

```typescript
// tests/e2e/plan/scheduler-e2e.spec.ts

describe("스케줄러 E2E", () => {
  it("관리자가 플래너 기반으로 플랜 생성", async () => {
    // 1. 관리자 로그인
    // 2. 학생 플래너 생성
    // 3. 3개 PlanGroup 추가 (각각 단일 콘텐츠)
    // 4. 플랜 생성 실행
    // 5. Today 뷰에서 플랜 확인
  });
});
```

---

## 8. 구현 체크리스트

### 8.1 타입 정의 (1일)

```markdown
[ ] lib/types/plan/scheduler.ts 신규 파일 생성
    [ ] PlannerWithSchedulerOptions 타입
    [ ] SingleContentPlanGroup 타입
    [ ] InternalGenerateParams 타입
    [ ] ContentInfoWithPlanGroup 타입
[ ] lib/types/plan/domain.ts 확장
    [ ] ScheduledPlanWithGroup 타입
```

### 8.2 스케줄러 리팩토링 (3일)

```markdown
[ ] lib/plan/scheduler.ts 리팩토링
    [ ] generatePlansInternal 함수 분리
    [ ] generatePlansFromPlanner 신규 함수
    [ ] planGroupToContentInfo 변환 함수
    [ ] buildPlanGroupIdMap 유틸리티
[ ] lib/plan/1730TimetableLogic.ts 수정
    [ ] calculateContentAllocationDates 외부 주입
    [ ] calculateReviewDurations 여러 콘텐츠 조율
[ ] lib/plan/adapters/legacyAdapter.ts 신규
    [ ] generatePlansFromGroupAdapter 어댑터
```

### 8.3 적응형 스케줄러 (1일)

```markdown
[ ] lib/domains/plan/services/adaptiveScheduler.ts
    [ ] adaptiveScheduleFromPlanner 추가
    [ ] 기존 adaptiveScheduleFromPlanGroup 유지
```

### 8.4 테스트 작성 (2일)

```markdown
[ ] tests/unit/plan/scheduler.test.ts
    [ ] generatePlansFromPlanner 테스트
    [ ] 블록 효율성 테스트
    [ ] 전략/취약 과목 테스트
    [ ] 복습일 조율 테스트
[ ] tests/unit/plan/legacyAdapter.test.ts
    [ ] generatePlansFromGroupAdapter 테스트
    [ ] 하위 호환성 검증
```

### 8.5 기존 호출부 마이그레이션 (Phase 3에서)

```markdown
[ ] lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts
[ ] lib/domains/admin-plan/actions/unifiedPlanCreate.ts
[ ] lib/domains/admin-plan/actions/batchAIPlanGeneration.ts
[ ] lib/domains/camp/actions/student.ts
```

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-01-19 | 초안 작성 | Claude |
