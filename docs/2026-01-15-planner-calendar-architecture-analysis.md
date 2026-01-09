# 플래너 시스템과 캘린더 아키텍처 현황 분석

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: ✅ 분석 완료

---

## 📋 목차

1. [개요](#개요)
2. [플래너 시스템 아키텍처](#플래너-시스템-아키텍처)
3. [캘린더 시스템 아키텍처](#캘린더-시스템-아키텍처)
4. [스케줄러 시스템](#스케줄러-시스템)
5. [데이터 모델 및 계층 구조](#데이터-모델-및-계층-구조)
6. [주요 컴포넌트 구조](#주요-컴포넌트-구조)
7. [데이터 흐름](#데이터-흐름)
8. [통합 포인트](#통합-포인트)
9. [현재 상태 및 개선 방향](#현재-상태-및-개선-방향)

---

## 개요

### 목적

플래너 시스템과 캘린더 시스템의 아키텍처를 종합적으로 분석하여:

- 시스템 간 상호작용 이해
- 데이터 흐름 파악
- 통합 포인트 식별
- 개선 방향 도출

### 핵심 개념

1. **플래너 (Planner)**: 학생별 학습 기간 단위 관리 (최상위 엔티티)
2. **플랜 그룹 (Plan Group)**: 특정 목적과 기간을 가진 플랜들의 집합
3. **플랜 (Plan)**: 실제 학습 일정에 배치되는 개별 학습 항목
4. **캘린더 뷰**: 플랜을 시각적으로 표시하는 UI (월/주/일 뷰)
5. **스케줄러**: 플랜을 시간에 배치하는 알고리즘

---

## 플래너 시스템 아키텍처

### 계층 구조

```
Planner (플래너)
  ├─ 기본 설정
  │   ├─ period_start, period_end (학습 기간)
  │   ├─ study_hours, self_study_hours (학습 시간)
  │   ├─ lunch_time (점심 시간)
  │   ├─ block_set_id (블록셋 연결)
  │   └─ default_scheduler_type (기본 스케줄러)
  │
  ├─ PlanGroup (플랜 그룹) [1:N]
  │   ├─ scheduler_type (스케줄러 타입)
  │   ├─ scheduler_options (스케줄러 옵션)
  │   ├─ period_start, period_end (플랜 그룹 기간)
  │   └─ daily_schedule (일별 스케줄)
  │
  └─ Plan (개별 플랜) [1:N]
      ├─ plan_date (날짜)
      ├─ start_time, end_time (시간)
      ├─ content_type, content_id (콘텐츠)
      └─ status (상태)
```

### 데이터베이스 스키마

#### planners 테이블

```sql
CREATE TABLE planners (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL,

    -- 기본 정보
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- 'draft', 'active', 'paused', 'archived', 'completed'

    -- 기간 설정
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_date DATE,

    -- 학습 시간 설정 (JSONB)
    study_hours JSONB DEFAULT '{"start": "10:00", "end": "19:00"}',
    self_study_hours JSONB DEFAULT '{"start": "19:00", "end": "22:00"}',
    lunch_time JSONB DEFAULT '{"start": "12:00", "end": "13:00"}',

    -- 블록셋 연결
    block_set_id UUID REFERENCES tenant_block_sets(id),

    -- 비학습시간 블록 (JSONB 배열)
    non_study_time_blocks JSONB DEFAULT '[]',

    -- 스케줄러 설정
    default_scheduler_type TEXT DEFAULT '1730_timetable',
    default_scheduler_options JSONB DEFAULT '{"study_days": 6, "review_days": 1}',

    -- 메타데이터
    admin_memo TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

#### 관련 테이블

- `planner_exclusions`: 제외일 관리
- `planner_academy_schedules`: 학원일정 관리
- `plan_groups`: 플랜 그룹 (planner_id로 연결)
- `student_plan`: 개별 플랜 (plan_group_id로 연결)

### 주요 기능

#### 1. 플래너 생성 및 관리

**위치**: `lib/domains/admin-plan/actions/planners.ts`

```typescript
// 플래너 생성
export async function createPlanner(
  input: CreatePlannerInput
): Promise<Planner>;

// 플래너 수정
export async function updatePlanner(
  id: string,
  input: UpdatePlannerInput
): Promise<Planner>;

// 플래너 조회
export async function getPlanner(id: string): Promise<Planner | null>;

// 플래너 목록 조회
export async function getPlannersByStudent(
  studentId: string
): Promise<Planner[]>;
```

#### 2. 플래너 스케줄 생성

**위치**: `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts`

```typescript
// 플래너 기반 스케줄 생성
export async function generateScheduleForPlanner(
  plannerId: string,
  periodStart: string,
  periodEnd: string
): Promise<ScheduleGenerationResult>;
```

**주요 기능**:

- 플래너 설정 기반 스케줄 생성
- 학원일정, 제외일, 블록셋 고려
- 날짜별 사용 가능 시간 범위 계산
- 시간 타임라인 생성

#### 3. 플래너 타임라인

**위치**: `components/plan/PlannerTimeline.tsx`

**기능**:

- 주간 타임라인 시각화
- 가용 학습 시간대 표시
- 기존 플랜 점유 시간 표시
- 빈 시간대 하이라이트

---

## 캘린더 시스템 아키텍처

### 뷰 구조

```
PlanCalendarView (메인 컨테이너)
  ├─ MonthView (월별 뷰)
  │   ├─ CalendarGrid (캘린더 그리드)
  │   ├─ MemoizedDayCell (일별 셀)
  │   └─ MonthViewModals (모달 관리)
  │
  ├─ WeekView (주별 뷰)
  │   ├─ WeekdayHeader (요일 헤더)
  │   ├─ DayTimeline (일별 타임라인)
  │   └─ DayTimelineModal (타임라인 모달)
  │
  └─ DayView (일별 뷰)
      ├─ TimelineItem (타임라인 아이템)
      └─ DayTimelineModal (타임라인 모달)
```

### 컴포넌트 계층

#### 1. PlanCalendarView (메인 컨테이너)

**위치**: `app/(student)/plan/calendar/_components/PlanCalendarView.tsx`

**주요 책임**:

- 뷰 모드 관리 (month/week/day)
- 필터링 상태 관리
- URL 파라미터 동기화
- 플랜 데이터 그룹화

**주요 Props**:

```typescript
type PlanCalendarViewProps = {
  plans: PlanWithContent[];
  adHocPlans?: AdHocPlanForCalendar[];
  view: "month" | "week" | "day";
  minDate: string;
  maxDate: string;
  initialDate: string;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dailySchedules: DailyScheduleInfo[][];
  studentId?: string;
  tenantId?: string;
  onPlansUpdated?: () => void;
};
```

#### 2. MonthView (월별 뷰)

**위치**: `app/(student)/plan/calendar/_components/MonthView.tsx`

**주요 기능**:

- 월별 캘린더 그리드 렌더링
- 날짜별 플랜 표시
- 드래그 앤 드롭 지원
- 날짜 클릭 이벤트 처리

**주요 훅**:

- `useCalendarData`: 날짜별 데이터 그룹화
- `useCalendarDragDrop`: 드래그 앤 드롭 관리
- `useMonthViewModals`: 모달 상태 관리
- `usePlanConnectionState`: 플랜 연결 상태 계산

#### 3. WeekView (주별 뷰)

**위치**: `app/(student)/plan/calendar/_components/WeekView.tsx`

**주요 기능**:

- 주별 타임라인 렌더링
- 시간대별 플랜 표시
- 플랜 연결 상태 표시
- 일별 타임라인 모달

**특징**:

- 시간 슬롯 기반 렌더링
- 플랜 연결 시각화 (같은 콘텐츠의 연속 플랜)
- 시간대별 색상 구분

#### 4. DayView (일별 뷰)

**위치**: `app/(student)/plan/calendar/_components/DayView.tsx`

**주요 기능**:

- 일별 상세 타임라인
- 시간대별 플랜 표시
- 플랜 상세 정보 모달
- 플랜 수정/삭제 기능

### 캘린더 훅 (Hooks)

#### 1. useCalendarData

**위치**: `app/(student)/plan/calendar/_hooks/useCalendarData.ts`

**기능**: 날짜별 플랜, 제외일, 학원일정 그룹화

```typescript
export function useCalendarData(
  plans: PlanWithContent[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  dateRange?: Date[]
): {
  plansByDate: Map<string, PlanWithContent[]>;
  exclusionsByDate: Map<string, PlanExclusion[]>;
  academySchedulesByDate: Map<string, AcademySchedule[]>;
};
```

#### 2. useCalendarDragDrop

**위치**: `app/(student)/plan/calendar/_hooks/useCalendarDragDrop.ts`

**기능**: 플랜 드래그 앤 드롭 관리

```typescript
export function useCalendarDragDrop(options: { onMoveSuccess?: () => void }): {
  draggedItem: DragItem | null;
  dropTarget: string | null;
  isMoving: boolean;
  isDragging: boolean;
  dragHandlers: DragHandlers;
  dropHandlers: DropHandlers;
  setDragImageElement: (element: HTMLElement | null) => void;
};
```

#### 3. usePlanConnectionState

**위치**: `app/(student)/plan/calendar/_hooks/usePlanConnectionState.ts`

**기능**: 플랜 연결 상태 계산 (같은 콘텐츠의 연속 플랜)

```typescript
export function usePlanConnectionState(
  plansByDate: Map<string, PlanWithContent[]>
): GetPlanConnectionStateFn;
```

### 캘린더 유틸리티

#### 1. calendarUtils

**위치**: `lib/date/calendarUtils.ts`

**주요 함수**:

- `formatDateString`: 날짜 포맷팅
- `parseDateString`: 날짜 파싱
- `formatMonthYear`: 월/년 포맷팅
- `formatWeekRangeShort`: 주 범위 포맷팅
- `getWeekStart`: 주 시작일 계산

#### 2. timelineUtils

**위치**: `app/(student)/plan/calendar/_utils/timelineUtils.ts`

**주요 함수**:

- `getTimeSlotColorClass`: 시간 슬롯 색상 클래스
- `getTimeSlotIcon`: 시간 슬롯 아이콘
- `getTimelineSlots`: 타임라인 슬롯 생성

---

## 스케줄러 시스템

### 스케줄러 타입

#### 1. 1730 Timetable

**위치**: `lib/plan/1730TimetableLogic.ts`

**특징**:

- 6일 학습 + 1일 복습 사이클
- 전략/취약 과목 분리 배정
- 블록 기반 시간 할당
- 복습의 복습 지원

**주요 함수**:

```typescript
export function generate1730TimetablePlans(
  availableDates: string[],
  contentInfos: ContentInfo[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  schedulerOptions?: SchedulerOptions
  // ... 기타 파라미터
): {
  plans: ScheduledPlan[];
  failureReasons: PlanGenerationFailureReason[];
};
```

#### 2. Default Scheduler

**위치**: `lib/plan/scheduler.ts`

**특징**:

- 기본 순차 배정
- 블록 기반 시간 할당
- 제외일, 학원일정 고려

### SchedulerEngine

**위치**: `lib/scheduler/SchedulerEngine.ts`

**주요 클래스**:

```typescript
export class SchedulerEngine {
  // 스케줄 생성
  generateSchedule(context: SchedulerContext): ScheduleResult;

  // 시간 슬롯 할당
  allocateTimeSlots(plans: ScheduledPlan[]): AllocatedPlan[];

  // 충돌 검사
  checkConflicts(plans: AllocatedPlan[]): Conflict[];
}
```

**주요 기능**:

- 날짜별 사용 가능 시간 범위 계산
- 시간 타임라인 생성
- 기존 플랜 고려한 시간 할당
- 충돌 감지 및 해결

### 스케줄 생성 프로세스

```
1. 플래너 설정 조회
   ├─ study_hours, self_study_hours
   ├─ block_set_id
   ├─ non_study_time_blocks
   └─ default_scheduler_type

2. 제약 조건 수집
   ├─ planner_exclusions (제외일)
   ├─ planner_academy_schedules (학원일정)
   └─ existing_plans (기존 플랜)

3. 스케줄 생성
   ├─ 날짜별 사용 가능 시간 범위 계산
   ├─ 시간 타임라인 생성
   └─ 블록 할당

4. 플랜 배정
   ├─ 콘텐츠 소요시간 계산
   ├─ Best Fit 알고리즘 적용
   └─ 시간 슬롯 할당
```

---

## 데이터 모델 및 계층 구조

### 엔티티 관계

```
Planner (1) ──< (N) PlanGroup (1) ──< (N) Plan
    │                │                    │
    │                │                    │
    ├─ exclusions    ├─ contents          ├─ content_id
    ├─ academy       ├─ daily_schedule   ├─ start_time
    │  schedules     └─ scheduler_type   └─ end_time
    └─ block_set
```

### 타입 정의

#### Planner

```typescript
export interface Planner {
  id: string;
  tenantId: string;
  studentId: string;
  name: string;
  description: string | null;
  status: PlannerStatus; // 'draft' | 'active' | 'paused' | 'archived' | 'completed'
  periodStart: string;
  periodEnd: string;
  targetDate: string | null;
  studyHours: TimeRange | null;
  selfStudyHours: TimeRange | null;
  lunchTime: TimeRange | null;
  blockSetId: string | null;
  nonStudyTimeBlocks: NonStudyTimeBlock[];
  defaultSchedulerType: string;
  defaultSchedulerOptions: Record<string, unknown>;
  // 관계 데이터
  exclusions?: PlannerExclusion[];
  academySchedules?: PlannerAcademySchedule[];
  planGroupCount?: number;
}
```

#### PlanGroup

```typescript
export type PlanGroup = {
  id: string;
  tenant_id: string;
  student_id: string;
  name: string | null;
  plan_purpose: PlanPurpose | null;
  scheduler_type: SchedulerType | null;
  scheduler_options?: SchedulerOptions | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  planner_id?: string | null; // 플래너 연결
  status: PlanStatus;
  daily_schedule?: DailyScheduleInfo[] | null;
  // ... 기타 필드
};
```

#### Plan

```typescript
export type Plan = {
  id: string;
  student_id: string;
  plan_group_id: string | null;
  plan_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string | null;
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  // 1730 Timetable 필드
  cycle_day_number?: number | null;
  date_type?: "study" | "review" | "exclusion" | null;
  time_slot_type?: "study" | "self_study" | null;
  // ... 기타 필드
};
```

---

## 주요 컴포넌트 구조

### 관리자 영역

#### AdminPlanManagement

**위치**: `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`

**주요 기능**:

- 플래너 선택 및 관리
- 플랜 생성 위저드
- 플랜 목록 표시 (Daily/Weekly/Unfinished Dock)
- 플랜 통계 및 대시보드

**주요 컴포넌트**:

- `PlannerManagement`: 플래너 목록/선택
- `PlannerCreationModal`: 플래너 생성/수정
- `AdminPlanCreationWizard7Step`: 플랜 생성 위저드
- `DailyDock`, `WeeklyDock`, `UnfinishedDock`: 플랜 컨테이너

#### PlannerTimeline

**위치**: `components/plan/PlannerTimeline.tsx`

**주요 기능**:

- 주간 타임라인 시각화
- 가용 학습 시간대 표시
- 기존 플랜 점유 시간 표시

### 학생 영역

#### PlanCalendarView

**위치**: `app/(student)/plan/calendar/_components/PlanCalendarView.tsx`

**주요 기능**:

- 월/주/일 뷰 전환
- 플랜 필터링
- 플랜 재조정 모달
- 충돌 해결 모달

---

## 데이터 흐름

### 플래너 생성 → 플랜 생성 흐름

```
1. 관리자가 플래너 생성
   └─ AdminPlanManagement
       └─ PlannerCreationModal
           └─ createPlanner() → planners 테이블

2. 플래너 선택
   └─ PlannerManagement
       └─ getPlannersByStudent() → planners 테이블

3. 플랜 그룹 생성
   └─ AdminPlanCreationWizard7Step
       └─ createPlanGroupAction() → plan_groups 테이블

4. 스케줄 생성
   └─ generateScheduleForPlanner()
       ├─ 플래너 설정 조회
       ├─ 제약 조건 수집
       └─ 스케줄 생성

5. 플랜 생성
   └─ generatePlansFromGroup()
       ├─ SchedulerEngine.generateSchedule()
       ├─ TimeAllocationService.allocateTimeSlots()
       └─ PlanPersistenceService.savePlans() → student_plan 테이블

6. 캘린더 표시
   └─ PlanCalendarView
       ├─ getPlansByDateRange() → student_plan 테이블
       └─ MonthView / WeekView / DayView 렌더링
```

### 캘린더 업데이트 흐름

```
1. 플랜 드래그 앤 드롭
   └─ useCalendarDragDrop
       └─ movePlanToDate() → student_plan 테이블 업데이트

2. 플랜 수정
   └─ EditPlanModal
       └─ updatePlan() → student_plan 테이블 업데이트

3. 플랜 삭제
   └─ ConditionalDeleteModal
       └─ deletePlan() → student_plan 테이블 업데이트

4. 실시간 업데이트
   └─ useAdminPlanRealtime
       └─ Supabase Realtime 구독
           └─ 캘린더 자동 새로고침
```

---

## 통합 포인트

### 1. 플래너 → 스케줄러 통합

**위치**: `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts`

**통합 방식**:

- 플래너 설정을 스케줄러 옵션으로 변환
- `generateScheduleForPlanner()` 함수로 통합

**주요 기능**:

```typescript
// 플래너 기반 스케줄 생성
const result = await generateScheduleForPlanner(
  plannerId,
  periodStart,
  periodEnd
);

// 결과: 날짜별 사용 가능 시간 범위, 시간 타임라인
const { dateAvailableTimeRanges, dateTimeSlots } = result;
```

### 2. 스케줄러 → 플랜 생성 통합

**위치**: `lib/plan/scheduler.ts`

**통합 방식**:

- `generatePlansFromGroup()` 함수에서 스케줄러 호출
- 스케줄 결과를 플랜 생성에 활용

**주요 기능**:

```typescript
const plans = await generatePlansFromGroup(
  group,
  contents,
  exclusions,
  academySchedules,
  blocks,
  // 스케줄 결과 전달
  dateAvailableTimeRanges,
  dateTimeSlots
);
```

### 3. 플랜 → 캘린더 통합

**위치**: `app/(student)/plan/calendar/page.tsx`

**통합 방식**:

- 플랜 데이터를 캘린더 뷰에 전달
- 날짜별 그룹화 후 렌더링

**주요 기능**:

```typescript
// 서버 컴포넌트에서 플랜 조회
const plans = await getPlansByDateRange(
  studentId,
  minDate,
  maxDate
);

// 캘린더 뷰에 전달
<PlanCalendarView
  plans={plans}
  exclusions={exclusions}
  academySchedules={academySchedules}
  dailySchedules={dailySchedules}
/>
```

### 4. 실시간 업데이트 통합

**위치**: `lib/realtime/useAdminPlanRealtime.ts`

**통합 방식**:

- Supabase Realtime 구독
- 플랜 변경 시 자동 새로고침

**주요 기능**:

```typescript
useAdminPlanRealtime({
  studentId,
  onPlanUpdated: () => {
    router.refresh();
    invalidateQueries();
  },
});
```

---

## 현재 상태 및 개선 방향

### 현재 상태

#### ✅ 완료된 기능

1. **플래너 시스템**
   - 플래너 생성/수정/삭제
   - 플래너 설정 관리 (학습시간, 블록셋 등)
   - 제외일, 학원일정 관리
   - 플래너 타임라인 시각화

2. **스케줄러 시스템**
   - 1730 Timetable 스케줄러
   - 플래너 기반 스케줄 생성
   - 기존 플랜 고려한 시간 할당
   - Best Fit 알고리즘

3. **캘린더 시스템**
   - 월/주/일 뷰
   - 드래그 앤 드롭
   - 필터링
   - 충돌 감지 및 해결

#### 🔄 진행 중인 작업

1. **플래너 스케줄러 통합**
   - Phase 1: 스케줄러 연동 함수 ✅
   - Phase 2: 1730 Timetable 방법론 준수 ✅
   - Phase 3: 단일 날짜 스케줄러 ✅

2. **아키텍처 개선 (2026-01-09 Phase 1 완료)** ✅
   - 기본값 상수화 (`lib/domains/admin-plan/constants/schedulerDefaults.ts`) ✅
   - 설정 상속 함수 추출 (`lib/domains/admin-plan/utils/plannerConfigInheritance.ts`) ✅
   - 시간 범위 유틸리티 통합 (`lib/scheduler/timeRangeUtils.ts`) ✅

3. **캘린더 성능 최적화** (Phase 2 대기)
   - 메모이제이션 적용
   - 가상 스크롤링 검토

### 개선 방향

#### 1. 아키텍처 개선 ✅ Phase 1 완료 (2026-01-09)

**해결된 문제점**:

- ~~플래너와 플랜 그룹 간 관계가 명확하지 않음~~ → 설정 상속 함수로 명확화
- ~~스케줄러 옵션 전달 경로가 복잡함~~ → 기본값 상수화로 일관성 확보
- ~~기본값 불일치 ("even" vs "1730_timetable")~~ → `SCHEDULER_DEFAULTS.TYPE`으로 통일

**완료된 개선**:

- `inheritPlannerConfigFromRaw()`: 플래너→플랜그룹 설정 상속 함수
- `SCHEDULER_DEFAULTS`: 기본값 상수 (TYPE, OPTIONS, STUDY_HOURS 등)
- `TimeRangeUtils`: 시간 범위 계산 유틸리티 클래스

**수정된 파일**:

- `planGroupSelector.ts`: 중복 상속 코드 제거
- `createAutoContentPlanGroup.ts`: 중복 상속 코드 제거
- `calculateAvailableDates.ts`: 시간 범위 함수 ~90줄 제거

**남은 작업 (Phase 2-3)**:

- DayView 컴포넌트 분할
- 스케줄러 옵션 전달 수정 (scheduleGenerator.ts)
- 스케줄러 Factory 패턴 도입

#### 2. 성능 개선 (Phase 2 예정)

**문제점**:

- 대량 플랜 조회 시 성능 저하
- 캘린더 렌더링 최적화 필요
- DayView 934줄, ContentLinkingModal 923줄 (거대 컴포넌트)

**개선 방안**:

- DayView 분할 (DayViewHeader, DayViewTimeline, DayViewContainers, AdHocPlanSection)
- Props 그룹화 (MemoizedDayCell 61개 Props → 20개 이하)
- 가상 스크롤링 도입

#### 3. 사용자 경험 개선

**문제점**:

- 플래너와 캘린더 간 일관성 부족
- 플랜 수정 시 즉시 반영 안 됨

**개선 방안**:

- 실시간 업데이트 강화
- 일관된 UI/UX 적용

#### 4. 코드 구조 개선 (Phase 3 예정)

**문제점**:

- 스케줄러 확장성 부족 (switch문 기반)
- 중복 로직 (planConnections 계산 등)

**개선 방안**:

- 스케줄러 Factory 패턴 도입
- 중복 훅 통합 (usePlanConnectionState 활용)
- ContentLinkingModal 분할

---

## 참고 문서

- [플래너 생성 및 플랜 관리 시스템 구조 분석](./2026-01-15-admin-planner-plan-creation-system-analysis.md)
- [플래너 스케줄러 통합 구현 상태](./2026-01-15-planner-scheduler-integration-implementation-status.md)
- [비즈니스 로직 분석 및 개선 방향](./2026-01-06-business-logic-analysis-and-improvements.md)
- [플랜 생성 아키텍처 분석](./architecture/plan-generation-architecture.md)

---

**마지막 업데이트**: 2026-01-09 (Phase 1 아키텍처 개선 완료)