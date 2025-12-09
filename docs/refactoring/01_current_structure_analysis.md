# 1. 현재 코드 기준 구조 요약

## 작성일: 2025-12-09

---

## 📋 개요

이 문서는 통합 리팩토링 요구서(total_refactoring_1209)와 비교하여 현재 코드베이스의 구조를 분석한 결과입니다.

---

## 🏗 1. 플랜 구조 현황

### 1.1 테이블 구조

| 테이블명 | 역할 | 위치 |
|---------|------|------|
| `plan_groups` | 플랜 그룹 (설계 단위/캠페인) | `timetable/erd-cloud/05_plan_tables.sql` |
| `student_plan` (student_plans) | 일일 플랜 (실행 조각) | `timetable/erd-cloud/05_plan_tables.sql` |
| `plan_group_contents` | 플랜 그룹-콘텐츠 관계 | 현재 코드에서 TypeScript 타입으로만 존재 (`PlanContent`) |

### 1.2 핵심 필드 (student_plan)

```sql
-- 식별/관계
id uuid PRIMARY KEY
tenant_id uuid NOT NULL
student_id uuid NOT NULL
plan_group_id uuid (FK → plan_groups)
plan_number integer -- 같은 논리 플랜을 묶는 키

-- 날짜/순서
plan_date date NOT NULL
block_index integer NOT NULL
sequence integer

-- 콘텐츠
content_type text ('book'|'lecture'|'custom')
content_id uuid NOT NULL
chapter text

-- 범위
planned_start_page_or_time integer
planned_end_page_or_time integer

-- 진행/실행
completed_amount integer
progress numeric (0-100)
actual_start_time timestamptz -- 실제 시작 시간
actual_end_time timestamptz   -- 실제 종료 시간
total_duration_seconds integer
paused_duration_seconds integer
pause_count integer

-- 메타
is_reschedulable boolean DEFAULT true
is_review boolean DEFAULT false
memo text
start_time time -- 계획된 시작 시간 (HH:mm)
end_time time   -- 계획된 종료 시간 (HH:mm)
```

### 1.3 TypeScript 타입 정의

| 타입명 | 파일 위치 | 설명 |
|-------|----------|------|
| `PlanGroup` | `lib/types/plan.ts` | 플랜 그룹 타입 |
| `Plan` | `lib/types/plan.ts` | 개별 플랜 타입 |
| `PlanContent` | `lib/types/plan.ts` | 플랜 콘텐츠 관계 |
| `ScheduledPlan` | `lib/plan/scheduler.ts` | 스케줄러 출력 타입 |

### 1.4 논리 플랜 처리 방식 (현재)

현재는 별도의 `plan_group_items` 테이블 없이:
- `plan_group_contents` 테이블에서 플랜 그룹의 콘텐츠 목록 관리
- `student_plan.plan_number`로 같은 논리 플랜 조각들을 그룹핑
- 콘텐츠 삭제/수정 시 관련 `student_plan` 레코드를 직접 조작

---

## ⏰ 2. 타임라인·시간 배치 로직 현황

### 2.1 핵심 함수

| 함수명 | 파일 위치 | 역할 |
|-------|----------|------|
| `calculateAvailableDates()` | `lib/scheduler/calculateAvailableDates.ts` | 학습 가능 날짜 및 시간대 계산 |
| `generateTimeSlots()` | `lib/scheduler/calculateAvailableDates.ts` | 시간 타임라인 생성 |
| `assignPlanTimes()` | `lib/plan/assignPlanTimes.ts` | 플랜을 학습시간 슬롯에 배치 |
| `generatePlansFromGroup()` | `lib/plan/scheduler.ts` | 플랜 그룹에서 개별 플랜 생성 |

### 2.2 타임라인 관련 타입

```typescript
// lib/scheduler/calculateAvailableDates.ts
export type DayType = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";

export type TimeSlot = {
  type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
  start: string; // HH:mm
  end: string;   // HH:mm
  label?: string;
};

export type DailySchedule = {
  date: string;
  day_type: DayType;
  study_hours: number;
  available_time_ranges: TimeRange[];
  time_slots?: TimeSlot[];
  // ...
};
```

### 2.3 시간 배치 흐름

```
1. calculateAvailableDates()
   └─ 입력: 기간, 블록, 제외일, 학원일정, 옵션
   └─ 출력: ScheduleAvailabilityResult (daily_schedule 포함)

2. generateTimeSlots()
   └─ 입력: 날짜, 요일 타입, 블록, 학원일정, 옵션
   └─ 출력: TimeSlot[] (시간 흐름 순 타임라인)

3. generatePlansFromGroup()
   └─ 입력: PlanGroup, contents, 스케줄 결과 등
   └─ 출력: ScheduledPlan[] (개별 플랜 조각)

4. assignPlanTimes()
   └─ 입력: plans, studyTimeSlots, contentDurationMap
   └─ 출력: PlanTimeSegment[] (시간 배치된 플랜)
```

---

## 🎭 3. 더미 콘텐츠 현황

### 3.1 현재 정의 위치

| 상수명 | 값 | 정의 위치 |
|-------|---|----------|
| `DUMMY_NON_LEARNING_CONTENT_ID` | `"00000000-0000-0000-0000-000000000000"` | `lib/plan/generators/planDataPreparer.ts:324` |
| `DUMMY_SELF_STUDY_CONTENT_ID` | `"00000000-0000-0000-0000-000000000001"` | `lib/plan/generators/planDataPreparer.ts:325` |

**문제점**: 
- 중앙 상수 파일 없이 여러 파일에서 하드코딩
- `lib/constants/planLabels.ts`에는 없음
- `student_custom_contents` 테이블에 정식 row가 있는지 불명확

### 3.2 더미 콘텐츠 사용처 (grep 결과)

1. `lib/plan/generators/planDataPreparer.ts` - contentDurationMap 초기화
2. `app/(student)/actions/plan-groups/plans.ts` - 플랜 생성 시 사용

---

## 📱 4. today·캠프 화면 현황

### 4.1 파일 구조

```
app/(student)/today/
├── _components/           # UI 컴포넌트
│   ├── PlanTimer.tsx
│   ├── PlanCard.tsx
│   ├── TodayPlansSection.tsx
│   └── timer/
│       ├── TimerControls.tsx
│       └── TimerDisplay.tsx
├── _utils/
│   ├── dateDisplay.ts
│   └── planGroupUtils.ts
├── actions/
│   ├── todayActions.ts      # 타이머 액션 (핵심)
│   ├── planMemoActions.ts
│   ├── planRangeActions.ts
│   └── timerResetActions.ts
└── page.tsx
```

### 4.2 타이머 액션 목록 (`todayActions.ts`)

| 함수명 | 역할 | 상태 전이 |
|-------|------|----------|
| `startPlan()` | 플랜 시작 | IDLE → RUNNING |
| `pausePlan()` | 일시정지 | RUNNING → PAUSED |
| `resumePlan()` | 재개 | PAUSED → RUNNING |
| `completePlan()` | 완료 기록 | RUNNING/PAUSED → COMPLETED |
| `preparePlanCompletion()` | 완료 준비 (세션 정리) | - |
| `postponePlan()` | 플랜 미루기 (내일로) | - |

### 4.3 세션 관리

- `student_study_sessions` 테이블에서 세션 추적
- `startStudySession()`, `endStudySession()` 함수 사용
- `paused_at`, `resumed_at`, `paused_duration_seconds` 필드로 일시정지 시간 관리

---

## 📊 5. 통계/리포트 현황

### 5.1 메트릭 모듈 구조

```
lib/metrics/
├── todayProgress.ts       # 오늘 진행률
├── getPlanCompletion.ts   # 주간 플랜 실행률
├── getStudyTime.ts        # 학습 시간 계산
├── studyTime.ts           # 학습 시간 유틸
├── getGoalStatus.ts       # 목표 상태
├── getScoreTrend.ts       # 성적 추이
├── getWeakSubjects.ts     # 취약 과목
├── getHistoryPattern.ts   # 학습 패턴
└── streak.ts              # 연속 학습 기록
```

### 5.2 완료 기준 불일치 현황 ⚠️

| 파일 | 사용 기준 | 코드 |
|-----|----------|------|
| `todayProgress.ts:73` | `actual_end_time` 존재 여부 | `!!plan.actual_end_time` |
| `getPlanCompletion.ts:47` | `completed_amount > 0` | `p.completed_amount > 0` |

**문제점**: 동일한 "완료" 개념이 다른 기준으로 판단됨

---

## 🔐 6. RLS/트리거 현황

### 6.1 현재 상태

마이그레이션 파일 분석 결과:
- `student_plan`에 대한 **RLS 정책 미정의**
- `updated_at` 자동 업데이트 **트리거 미정의**
- 코드 레벨에서 `updated_at` 수동 설정

### 6.2 관련 인덱스 (존재함)

```sql
-- 20250105000000_add_performance_indexes_for_today_plans.sql
CREATE INDEX idx_student_plan_today 
  ON student_plan(tenant_id, student_id, plan_date, plan_group_id);

-- 20250107000000_optimize_today_plans_indexes.sql
CREATE INDEX idx_student_plan_optimized 
  ON student_plan(student_id, plan_date, block_index) 
  INCLUDE(...);
```

---

## 🗂 7. 주요 파일 목록

### 플랜 생성/관리

| 파일 | 역할 |
|-----|------|
| `lib/plan/scheduler.ts` | 플랜 스케줄러 메인 로직 |
| `lib/plan/assignPlanTimes.ts` | 시간 배치 유틸 |
| `lib/plan/generators/planDataPreparer.ts` | 플랜 생성 데이터 준비 |
| `lib/scheduler/calculateAvailableDates.ts` | 가용 날짜/시간 계산 |
| `lib/data/studentPlans.ts` | student_plan CRUD |
| `lib/data/planGroups.ts` | plan_groups CRUD |

### 타입 정의

| 파일 | 역할 |
|-----|------|
| `lib/types/plan.ts` | 플랜 관련 모든 타입 |

### Server Actions

| 파일 | 역할 |
|-----|------|
| `app/(student)/today/actions/todayActions.ts` | 타이머 관련 액션 |
| `app/(student)/actions/plan-groups/plans.ts` | 플랜 그룹 관련 액션 |

---

## 📝 요약

| 영역 | 현재 상태 | 주요 이슈 |
|-----|----------|----------|
| 플랜 구조 | PlanGroup + student_plan 2계층 | 논리 플랜(plan_group_items) 부재 |
| 타임라인 | 복잡한 다단계 로직 | 역할 분리 불명확 |
| 더미 콘텐츠 | 하드코딩 분산 | 중앙 상수 부재 |
| today/타이머 | 완성된 기본 기능 | 상태 전이 문서화 필요 |
| 통계/리포트 | 다양한 메트릭 존재 | 완료 기준 불일치 |
| RLS/트리거 | 미정의 | 보안/무결성 가드 부재 |

