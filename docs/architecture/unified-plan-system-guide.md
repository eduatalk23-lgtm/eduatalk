# 통합 플랜 시스템 가이드

> 작성일: 2026-01-20
> 목적: 플랜 시스템 아키텍처 이해를 위한 시각화 문서

---

## 1. 핵심 개념도

### 1.1 데이터베이스 테이블 관계

```
                              [planners]
                                  │
                                  │ 1:N (planner_id FK)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          [plan_groups]                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Phase 3.1 단일 콘텐츠 모드 (is_single_content = true)        │    │
│  │                                                              │    │
│  │  • content_type    : 'book' | 'lecture' | 'custom'          │    │
│  │  • content_id      : UUID (마스터 콘텐츠 또는 flexible)      │    │
│  │  • start_range     : 시작 페이지/회차                        │    │
│  │  • end_range       : 종료 페이지/회차                        │    │
│  │  • planner_id      : 플래너 연결 (필수)                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 레거시 다중 콘텐츠 모드 (is_single_content = false)          │    │
│  │                                                              │    │
│  │  • plan_contents 테이블 참조 (1:N)                          │    │
│  │  • 캠프 슬롯 모드에서 사용                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
          [student_plan]   [ad_hoc_plans]   [plan_contents]
           (통합 저장소)     (레거시)         (레거시 다중)
```

### 1.2 테이블 역할 요약

| 테이블 | 역할 | Phase 3.1 상태 |
|--------|------|----------------|
| **planners** | 학생의 학습 설정 컨테이너 | 필수 (자동 생성) |
| **plan_groups** | 콘텐츠별 학습 계획 단위 | 단일 콘텐츠 모드 |
| **student_plan** | 일별 실제 학습 항목 | 통합 저장소 (권장) |
| **ad_hoc_plans** | 단발성 플랜 | 레거시 (deprecation 예정) |
| **plan_contents** | 플랜그룹-콘텐츠 연결 | 레거시 (캠프용만 유지) |

---

## 2. 플랜 생성 흐름 비교

### 2.1 현재 시스템 (이중 구조)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        현재 플랜 생성 흐름                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [관리자 생성]                          [학생 생성]                  │
│       │                                      │                       │
│       ▼                                      ▼                       │
│  createUnifiedPlan()              createStudentAdHocPlan()          │
│       │                                      │                       │
│       │ requireAdminOrConsultant             │ getCurrentUser        │
│       │                                      │                       │
│       ▼                                      ▼                       │
│  ┌──────────────┐                    ┌──────────────┐               │
│  │ student_plan │                    │ ad_hoc_plans │               │
│  │              │                    │              │               │
│  │ • is_adhoc   │                    │ • title      │               │
│  │ • plan_group │                    │ • plan_date  │               │
│  │   _id        │                    │ • status     │               │
│  └──────────────┘                    └──────────────┘               │
│         ✓                                   ✗                        │
│    Phase 3.1 준수                      레거시 테이블                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

문제점:
  1. 학생/관리자가 다른 테이블 사용
  2. 캘린더에서 두 테이블 조인 필요
  3. 통계/분석 복잡
```

### 2.2 목표 시스템 (통합 구조)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        목표 플랜 생성 흐름                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [관리자 생성]                          [학생 생성]                  │
│       │                                      │                       │
│       ▼                                      ▼                       │
│  createUnifiedPlan()                  createQuickPlan() (NEW)       │
│       │                                      │                       │
│       │ requireAdminOrConsultant             │ resolveAuthContext   │
│       │                                      │                       │
│       └──────────────┬───────────────────────┘                      │
│                      │                                               │
│                      ▼                                               │
│                 ensurePlanGroup()                                    │
│                      │                                               │
│                      │ planner_id 자동 연결                          │
│                      │ is_single_content: true                       │
│                      │                                               │
│                      ▼                                               │
│               ┌──────────────┐                                       │
│               │ student_plan │  ← 모든 플랜 저장                     │
│               │              │                                       │
│               │ • is_adhoc   │  ← 단발성 여부 구분                   │
│               │ • plan_group │                                       │
│               │   _id        │                                       │
│               └──────────────┘                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

장점:
  1. 단일 테이블로 통합 관리
  2. 캘린더 조회 단순화
  3. 일관된 통계/분석
```

---

## 3. 상세 데이터 모델

### 3.1 planners (플래너)

```
┌─────────────────────────────────────────────────────────────────────┐
│                            planners                                  │
├─────────────────────────────────────────────────────────────────────┤
│  id                    : UUID (PK)                                   │
│  tenant_id             : UUID (FK → tenants)                         │
│  student_id            : UUID (FK → students)                        │
│  name                  : TEXT ("기본 플래너")                        │
│  description           : TEXT                                        │
│  period_start          : DATE                                        │
│  period_end            : DATE                                        │
│  study_hours           : JSONB  { start: "10:00", end: "19:00" }    │
│  self_study_hours      : JSONB  { start: "19:00", end: "22:00" }    │
│  lunch_time            : JSONB  { start: "12:00", end: "13:00" }    │
│  default_scheduler_type: TEXT ("1730_timetable")                    │
│  default_scheduler_opts: JSONB  { study_days: 6, review_days: 1 }   │
│  status                : TEXT ("active" | "draft" | "archived")      │
├─────────────────────────────────────────────────────────────────────┤
│  역할: 학생의 전체 학습 설정을 관리하는 컨테이너                     │
│        여러 plan_groups를 조율                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 plan_groups (플랜 그룹)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           plan_groups                                │
├─────────────────────────────────────────────────────────────────────┤
│  id                    : UUID (PK)                                   │
│  tenant_id             : UUID (FK → tenants)                         │
│  student_id            : UUID (FK → students)                        │
│  planner_id            : UUID (FK → planners) ← Phase 3.1 연결      │
│  name                  : TEXT ("수학 교재 A")                        │
│  period_start          : DATE                                        │
│  period_end            : DATE                                        │
│  status                : TEXT ("draft" | "active" | "completed")     │
│  ──────────────────────────────────────────────────────────────────│
│  [Phase 3.1 단일 콘텐츠 필드]                                        │
│  is_single_content     : BOOLEAN (true)                              │
│  content_type          : TEXT ("book" | "lecture" | "custom")        │
│  content_id            : UUID (마스터 콘텐츠 ID)                     │
│  master_content_id     : UUID (원본 콘텐츠 연결)                     │
│  start_range           : INTEGER (시작 페이지/회차)                  │
│  end_range             : INTEGER (종료 페이지/회차)                  │
│  study_type            : TEXT ("weakness" | "strategy")              │
│  strategy_days_per_week: INTEGER (전략과목 주당 학습일)              │
│  ──────────────────────────────────────────────────────────────────│
│  [스케줄러 설정]                                                     │
│  scheduler_type        : TEXT ("1730_timetable")                     │
│  scheduler_options     : JSONB                                       │
├─────────────────────────────────────────────────────────────────────┤
│  역할: 하나의 콘텐츠에 대한 학습 계획 단위                           │
│        예: "수학 교재 A를 1-100페이지 30일간 학습"                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 student_plan (학생 플랜 - 통합 저장소)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          student_plan                                │
├─────────────────────────────────────────────────────────────────────┤
│  id                    : UUID (PK)                                   │
│  tenant_id             : UUID (FK → tenants)                         │
│  student_id            : UUID (FK → students)                        │
│  plan_group_id         : UUID (FK → plan_groups)                     │
│  plan_date             : DATE                                        │
│  ──────────────────────────────────────────────────────────────────│
│  [콘텐츠 정보]                                                       │
│  content_type          : TEXT                                        │
│  content_id            : UUID                                        │
│  content_title         : TEXT                                        │
│  flexible_content_id   : UUID                                        │
│  planned_start_page    : INTEGER                                     │
│  planned_end_page      : INTEGER                                     │
│  ──────────────────────────────────────────────────────────────────│
│  [실행 정보]                                                         │
│  status                : TEXT ("pending" | "in_progress" | "done")   │
│  actual_start_time     : TIMESTAMP                                   │
│  actual_end_time       : TIMESTAMP                                   │
│  completed_amount      : INTEGER                                     │
│  ──────────────────────────────────────────────────────────────────│
│  [단발성 플랜 지원 필드] ← 이미 존재!                                │
│  is_adhoc              : BOOLEAN (단발성 플랜 여부)                  │
│  adhoc_source_id       : UUID (원본 ad_hoc_plans ID)                 │
│  description           : TEXT (설명)                                 │
│  tags                  : TEXT[] (태그)                               │
│  color                 : TEXT (색상)                                 │
│  icon                  : TEXT (아이콘)                               │
│  container_type        : TEXT ("daily" | "weekly")                   │
├─────────────────────────────────────────────────────────────────────┤
│  역할: 일별 학습 항목 (스케줄러에서 생성된 모든 플랜)                │
│        is_adhoc=true면 단발성 플랜                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.4 ad_hoc_plans (레거시 - deprecation 예정)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ad_hoc_plans                                │
├─────────────────────────────────────────────────────────────────────┤
│  id                    : UUID (PK)                                   │
│  tenant_id             : UUID                                        │
│  student_id            : UUID                                        │
│  plan_group_id         : UUID (FK → plan_groups) ← 이미 연결됨      │
│  plan_date             : DATE                                        │
│  title                 : TEXT                                        │
│  status                : TEXT                                        │
│  container_type        : TEXT                                        │
│  ...                                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  상태: @deprecated                                                   │
│  이유: student_plan.is_adhoc=true로 통합 가능                       │
│  현재: 학생 UI에서 여전히 사용 중                                    │
│  계획: createQuickPlan으로 student_plan 사용하도록 전환             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. API 흐름도

### 4.1 관리자용: createUnifiedPlan (기존)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     createUnifiedPlan 흐름                           │
└─────────────────────────────────────────────────────────────────────┘

요청:
  {
    studentId: "...",
    tenantId: "...",
    planDate: "2026-01-20",
    title: "수학 문제풀이",
    isAdhoc: true,
    plannerId: "..." (선택)
  }

                              ┌─────────────────┐
                              │  요청 시작      │
                              └────────┬────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 1. 인증 검증                      │
                    │    requireAdminOrConsultant()    │
                    │    → 관리자/상담사만 허용        │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 2. 콘텐츠 확보                    │
                    │    isFreeLearning이면            │
                    │    flexible_contents 생성        │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 3. ensurePlanGroup()             │
                    │    - plannerId 있으면 연결       │
                    │    - 없으면 독립 그룹 생성       │
                    │    - is_single_content: true     │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 4. student_plan INSERT           │
                    │    - is_adhoc: true (단발성)     │
                    │    - plan_group_id: 연결         │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 5. 이벤트 로깅                    │
                    │    - unified_adhoc_created       │
                    │    - actor_type: "admin"         │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  응답 반환      │
                              │  { planId,      │
                              │    planGroupId }│
                              └─────────────────┘
```

### 4.2 학생용: createStudentAdHocPlan (레거시)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  createStudentAdHocPlan 흐름 (레거시)                │
└─────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  요청 시작      │
                              └────────┬────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 1. 인증 검증                      │
                    │    getCurrentUser()              │
                    │    → 본인 플랜만 허용            │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 2. ad_hoc_plans INSERT           │  ← 문제!
                    │    - plan_group_id 필수          │
                    │    - planner_id 연결 없음        │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  응답 반환      │
                              └─────────────────┘

문제점:
  ❌ ad_hoc_plans 테이블 사용 (레거시)
  ❌ planner와 연결 안 됨
  ❌ Phase 3.1 아키텍처 미준수
```

### 4.3 학생용: createQuickPlan (신규 제안)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    createQuickPlan 흐름 (신규 제안)                  │
└─────────────────────────────────────────────────────────────────────┘

요청:
  {
    title: "영어 단어 암기",
    planDate: "2026-01-20",
    estimatedMinutes: 30,
    studentId: "..." (관리자 모드 시)
  }

                              ┌─────────────────┐
                              │  요청 시작      │
                              └────────┬────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 1. 인증 검증                      │
                    │    resolveAuthContext()          │
                    │    → 학생/관리자 모두 가능       │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 2. Planner 확보                   │
                    │    getOrCreateDefaultPlanner()   │
                    │    → 없으면 자동 생성            │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 3. PlanGroup 확보                 │
                    │    ensurePlanGroupForQuickAdd()  │
                    │    - planner_id 연결             │
                    │    - is_single_content: true     │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 4. student_plan INSERT           │
                    │    - is_adhoc: true              │
                    │    - plan_group_id 연결          │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ 5. 이벤트 로깅                    │
                    │    - unified_adhoc_created       │
                    │    - actor_type: 동적            │
                    └──────────────────┬───────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  응답 반환      │
                              └─────────────────┘

장점:
  ✅ student_plan 테이블 사용 (통합)
  ✅ Planner 자동 연결
  ✅ Phase 3.1 아키텍처 준수
  ✅ 학생/관리자 모두 사용 가능
```

---

## 5. UI 컴포넌트 매핑

### 5.1 현재 학생 UI → API 매핑

```
┌─────────────────────────────────────────────────────────────────────┐
│                        학생 UI 컴포넌트                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Today 페이지]                                                      │
│  app/(student)/today/_components/                                    │
│       │                                                              │
│       ├─ EnhancedAddPlanModal.tsx                                   │
│       │       │                                                      │
│       │       └─→ createStudentAdHocPlan()  ← 레거시                │
│       │                    │                                         │
│       │                    ▼                                         │
│       │             ad_hoc_plans 테이블                              │
│       │                                                              │
│       └─ PromotionSuggestionCard.tsx                                │
│               │                                                      │
│               └─→ promoteToRegularPlan()                            │
│                                                                      │
│  [Calendar 페이지]                                                   │
│  app/(student)/plan/calendar/_components/                            │
│       │                                                              │
│       └─ QuickAddPlanModal.tsx                                      │
│               │                                                      │
│               └─→ createStudentAdHocPlan()  ← 레거시                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 목표 UI → API 매핑

```
┌─────────────────────────────────────────────────────────────────────┐
│                      목표 학생 UI 컴포넌트                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Today 페이지]                                                      │
│       │                                                              │
│       ├─ EnhancedAddPlanModal.tsx                                   │
│       │       │                                                      │
│       │       └─→ createQuickPlan()  ← 신규 통합 API                │
│       │                    │                                         │
│       │                    ▼                                         │
│       │             student_plan 테이블                              │
│       │             (is_adhoc = true)                                │
│       │                                                              │
│       └─ PromotionSuggestionCard.tsx                                │
│               │                                                      │
│               └─→ promoteToRegularPlan()  ← 개선 필요               │
│                                                                      │
│  [Calendar 페이지]                                                   │
│       │                                                              │
│       └─ QuickAddPlanModal.tsx                                      │
│               │                                                      │
│               └─→ createQuickPlan()  ← 신규 통합 API                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 마이그레이션 계획

### 6.1 단계별 전환

```
현재 상태                       목표 상태
─────────────────────────────────────────────────────────────────────

[1단계: API 생성]
                                createQuickPlan()
ad_hoc_plans ───────────────→   student_plan (is_adhoc=true)
                                planner 자동 연결

[2단계: UI 전환]
EnhancedAddPlanModal            EnhancedAddPlanModal
  └─ createStudentAdHocPlan  →    └─ createQuickPlan ✓

QuickAddPlanModal               QuickAddPlanModal
  └─ createStudentAdHocPlan  →    └─ createQuickPlan ✓

[3단계: 레거시 유지]
ad_hoc_plans                    ad_hoc_plans
  - 기존 데이터 유지              - 조회만 허용
  - 신규 생성 X                   - @deprecated

[4단계: 통합 조회 (선택)]
Today/Calendar 조회              UNION VIEW
  student_plan                   student_plan
  + ad_hoc_plans            →    + ad_hoc_plans (읽기 전용)
```

### 6.2 하위 호환성

```
┌─────────────────────────────────────────────────────────────────────┐
│                         하위 호환성 보장                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  기존 ad_hoc_plans 데이터:                                          │
│    - Today 페이지에서 계속 표시                                      │
│    - 타이머/완료 기능 계속 동작                                      │
│    - 신규 생성만 student_plan으로 전환                               │
│                                                                      │
│  기존 API:                                                           │
│    - getAdHocPlans() : 유지 (조회용)                                 │
│    - getTodayAdHocPlans() : 유지 (Today 화면용)                      │
│    - createStudentAdHocPlan() : @deprecated 경고                    │
│                                                                      │
│  데이터 조회 통합:                                                   │
│    lib/data/todayPlans.ts에서 이미 두 테이블 조회 중                 │
│    → 변경 없이 동작                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. 요약

### 핵심 포인트

1. **student_plan 테이블에 이미 `is_adhoc` 컬럼 존재**
   - 통합 저장소로 사용 가능
   - ad_hoc_plans와 거의 동일한 필드 보유

2. **createUnifiedPlan은 이미 Phase 3.1 준수**
   - 문제는 "관리자 전용"이라는 점
   - 학생 접근 불가

3. **해결책: createQuickPlan (학생용 통합 API)**
   - resolveAuthContext로 학생/관리자 모두 지원
   - student_plan 테이블 사용
   - Planner 자동 연동

4. **레거시 호환성**
   - 기존 ad_hoc_plans 데이터는 유지
   - 신규 데이터만 student_plan으로 전환
   - 점진적 마이그레이션 가능
