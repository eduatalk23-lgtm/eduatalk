# 플랜 시스템 통합 아키텍처 설계

> **작성일**: 2026-01-19
> **상태**: 설계 확정, 구현 대기
> **선택된 옵션**: Option A (단일 콘텐츠 플랜그룹)

## 목차

1. [배경 및 목표](#1-배경-및-목표)
2. [현재 시스템 구조](#2-현재-시스템-구조)
3. [목표 구조](#3-목표-구조)
4. [스케줄러 연관성 분석](#4-스케줄러-연관성-분석)
5. [스키마 변경 계획](#5-스키마-변경-계획)
6. [코드 변경 영향 범위](#6-코드-변경-영향-범위)
7. [구현 단계](#7-구현-단계)
8. [기능 인벤토리](#8-기능-인벤토리)
9. [리스크 및 대응](#9-리스크-및-대응)
10. [검증 체크리스트](#10-검증-체크리스트)

---

## 1. 배경 및 목표

### 1.1 현재 문제점

현재 TimeLevelUp의 플랜 관련 기능이 여러 영역에 분산되어 있음:

| 문제 | 상세 |
|------|------|
| **코드 중복/유지보수** | 비슷한 로직이 여러 곳에 분산, 수정 시 여러 파일 변경 필요 |
| **기능 불일치** | 학생/관리자/캠프 간 기능 차이, 일관된 경험 제공 어려움 |
| **확장성 문제** | 새 기능 추가 시 위치 불명확, 영향 범위 파악 어려움 (가장 시급) |
| **데이터 흐름 복잡** | 플랜 데이터가 여러 경로로 생성, 추적/분석 어려움 |

### 1.2 최종 목표

1. **단일 생성 파이프라인**: 학생/관리자/캠프 모두 동일한 내부 로직으로 플랜 생성
2. **플래너 중심 관리**: 모든 플랜을 '플래너'를 통해 관리, 여러 콘텐츠 조율
3. **데이터 모델 통합**: ad_hoc_plans 등 분산된 테이블을 student_plan으로 통합
4. **UI/UX 통합**: 학생/관리자 화면 경험을 일관되게 통합

### 1.3 핵심 개념 변경 (사용자 의도)

| 개념 | 현재 역할 | 변경 후 역할 |
|------|----------|------------|
| **Planner** | 전역 학습 설정만 | **설정 + 여러 콘텐츠 묶음 + 스케줄러 조율** |
| **PlanGroup** | 여러 콘텐츠 포함 (1:N) | **단일 콘텐츠만** (콘텐츠별 진행상황 추적) |
| **plan_contents** | plan_group과 content 연결 | **제거 또는 deprecation** |

### 1.4 서비스 운영 조건

- 유지보수 윈도우 활용 가능 (공지 후 일정 시간 서비스 중단 가능)

---

## 2. 현재 시스템 구조

### 2.1 기존 데이터 모델

```
현재 구현:
┌─────────────────────────────────────────────────────────────────┐
│ Planner (플래너)                                                │
│ - 학습 시간 설정 (study_hours, self_study_hours, lunch_time)   │
│ - 기본 스케줄러 설정 (default_scheduler_type, options)          │
│ - 블록 세트 참조 (block_set_id)                                 │
│ - ❌ 콘텐츠 포함 안 함                                          │
│ - ❌ 스케줄러 조율 역할 없음                                    │
└─────────────────────────────────────────────────────────────────┘
                              │ (선택적 참조: planner_id)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Plan Group (플랜 그룹)                                          │
│ - 학습 기간, 목적, 상태                                         │
│ - 스케줄러 옵션 (scheduler_options) ← 여러 콘텐츠 조율          │
│ - ✅ 여러 콘텐츠 포함 (plan_contents 1:N, 최대 9개)             │
│ - ✅ 스케줄러의 입력 단위                                       │
└─────────────────────────────────────────────────────────────────┘
           │ 1:N                              │ 1:N
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│ plan_contents       │            │ student_plan        │
│ - content_id        │            │ - content_id        │
│ - start_range       │            │ - plan_date         │
│ - end_range         │            │ - status            │
│ - display_order     │            │ - 실제 학습 기록    │
└─────────────────────┘            └─────────────────────┘
```

### 2.2 기존 테이블 주요 컬럼

#### planners 테이블

```typescript
interface Planner {
  id: string;
  tenant_id: string;
  student_id: string;
  name: string;
  period_start: string;
  period_end: string;
  study_hours: TimeRange | null;        // 학습 시간
  self_study_hours: TimeRange | null;   // 자율학습 시간
  lunch_time: TimeRange | null;         // 점심 시간
  block_set_id: string | null;          // 블록 세트
  default_scheduler_type: string;
  default_scheduler_options: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed';
}
```

#### plan_groups 테이블

```typescript
interface PlanGroup {
  id: string;
  tenant_id: string;
  student_id: string;
  planner_id?: string | null;           // 선택적 연결
  name: string | null;
  plan_purpose: string | null;          // 내신대비, 모의고사, 수능, 기타
  period_start: string;
  period_end: string;
  scheduler_type: string | null;
  scheduler_options?: SchedulerOptions; // 여러 콘텐츠 조율 정보
  status: string;
  // ... 기타 필드
}
```

#### plan_contents 테이블

```typescript
interface PlanContent {
  id: string;
  tenant_id: string;
  plan_group_id: string;                // FK to plan_groups
  content_type: string;                 // book, lecture, custom
  content_id: string;
  master_content_id?: string;
  start_range: number;
  end_range: number;
  display_order: number;
  // ... 추천 관련 필드
}
```

### 2.3 기존 기능 영역 (분산됨)

| 영역 | 위치 | 기능 |
|------|------|------|
| **학생 플랜** | `app/(student)/plan/`, `lib/domains/plan/` | 7단계 위자드, 재스케줄링, 캘린더 |
| **관리자 플랜** | `app/(admin)/`, `lib/domains/admin-plan/` | 배치 생성, AI 플랜, 플래너 관리 |
| **캠프** | `lib/domains/camp/` | 템플릿, 초대, 진행 추적 |
| **Today/실행** | `lib/domains/today/` | 타이머, 컨테이너, 동기화 |
| **공통 서비스** | `lib/plan/`, `lib/domains/plan/services/` | 스케줄러, 검증, 캐시 |

---

## 3. 목표 구조

### 3.1 목표 데이터 모델

```
목표 구조:
┌─────────────────────────────────────────────────────────────────┐
│ Planner (플래너) - 역할 대폭 강화                               │
│ - 학습 시간 설정 (기존 유지)                                    │
│ - scheduler_options ← plan_group에서 이동                       │
│ - ✅ 여러 플랜 그룹의 "허브" 역할                               │
│ - ✅ 시간 슬롯 조율자 (블록 효율성)                             │
│ - ✅ 전략/취약과목 배정 단위                                    │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N (필수)
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Plan Group A    │  │ Plan Group B    │  │ Plan Group C    │
│ (콘텐츠 A)      │  │ (콘텐츠 B)      │  │ (콘텐츠 C)      │
│ - 단일 콘텐츠   │  │ - 단일 콘텐츠   │  │ - 단일 콘텐츠   │
│ - content_type  │  │ - content_type  │  │ - content_type  │
│ - content_id    │  │ - content_id    │  │ - content_id    │
│ - start_range   │  │ - start_range   │  │ - start_range   │
│ - end_range     │  │ - end_range     │  │ - end_range     │
│ - 진행상황 추적 │  │ - 진행상황 추적 │  │ - 진행상황 추적 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
    student_plan        student_plan        student_plan
    (날짜별 플랜)       (날짜별 플랜)       (날짜별 플랜)
```

### 3.2 변경 후 테이블 구조

#### planners 테이블 (확장)

```typescript
interface Planner {
  // 기존 필드 유지
  id: string;
  tenant_id: string;
  student_id: string;
  name: string;
  period_start: string;
  period_end: string;
  study_hours: TimeRange | null;
  self_study_hours: TimeRange | null;
  lunch_time: TimeRange | null;
  block_set_id: string | null;
  default_scheduler_type: string;

  // 새로 추가/이동
  scheduler_options: SchedulerOptions;   // plan_groups에서 이동
  // subject_allocations, content_allocations 포함

  status: 'active' | 'paused' | 'completed';
}
```

#### plan_groups 테이블 (변경)

```typescript
interface PlanGroup {
  id: string;
  tenant_id: string;
  student_id: string;
  planner_id: string;                    // 필수로 변경 (NOT NULL)

  // 단일 콘텐츠 정보 (plan_contents에서 이동)
  content_type: string;                  // book, lecture, custom
  content_id: string;
  master_content_id?: string;
  start_range: number;
  end_range: number;

  // 기존 필드 유지
  name: string | null;
  period_start: string;
  period_end: string;
  status: string;

  // scheduler_options는 제거 또는 override용으로만 유지
}
```

#### plan_contents 테이블 (Deprecation)

```
Phase 1: 유지 (하위 호환성)
Phase 2: 새 데이터는 plan_groups 컬럼 사용
Phase 3: 레거시 데이터 마이그레이션 후 읽기 전용
Phase 4: 테이블 제거 (선택적)
```

---

## 4. 스케줄러 연관성 분석

### 4.1 여러 콘텐츠를 함께 처리하는 이유

현재 스케줄러가 plan_group 단위로 여러 콘텐츠를 함께 처리하는 핵심 이유:

#### (1) 블록(시간 슬롯) 효율성

```
14:00~17:00 블록 (180분)
├─ 수학(취약) 30분
├─ 국어(전략) 90분
└─ 영어(취약) 60분
= 정확히 180분 (블록 100% 활용)
```

- 단일 콘텐츠로 분리하면 블록 낭비 또는 충돌 발생
- 예: 수학만 30분이면 150분 낭비

#### (2) 전략과목/취약과목 날짜 배정

```typescript
// scheduler_options 내 subject_allocations
subject_allocations: [
  { subject: "수학", type: "weakness" },       // 6일/주 전체
  { subject: "국어", type: "strategy", weekly_days: 3 }  // 3일/주만
]
```

- 취약과목: 모든 학습일 (4주 × 6일 = 24일)
- 전략과목: 선택된 일수만 (4주 × 3일 = 12일)
- 여러 콘텐츠를 동시에 고려해야 균형 잡힌 배정

#### (3) 복습일 통합 처리

```
복습일 (일요일):
├─ 수학 복습: 기본시간 × 0.4 (복습계수)
├─ 국어 복습: 기본시간 × 0.4
└─ 영어 복습: 기본시간 × 0.4
총시간 = 합계 (블록에 fit하도록 조율)
```

### 4.2 콘텐츠 간 의존성

| 의존성 | 설명 |
|--------|------|
| **동일 날짜/블록 공유** | 같은 시간대에 여러 콘텐츠 순차 배치 |
| **1730 주기 동시 진행** | 학습일/복습일 구분이 모든 콘텐츠에 동일 적용 |
| **복습일 시간 조율** | 모든 콘텐츠의 복습을 한 날짜에 함께 계산 |

### 4.3 단일 콘텐츠 분리 시 문제점

| 문제 | 현재 | 분리 후 (해결 전) |
|------|------|------------------|
| **블록 효율성** | 3콘텐츠가 180분 블록 공유 → 100% | 각각 독립적 → 낭비 심각 |
| **전략과목 배정** | 과목별로 명확히 정의 | 각 콘텐츠마다 따로 → 중복/모순 |
| **학습 부하** | 일일 총 학습량 균형 | 각 콘텐츠 독립적 → 불균형 |
| **복습일** | 모든 콘텐츠 함께 복습 | 각각 독립적 → 시간 초과 |

### 4.4 해결책: 스케줄러 조율 책임 이동

```
현재:
PlanGroup ─────────────→ Scheduler (plan_group 단위로 조율)
  └─ [Content A, B, C]

변경 후:
Planner ───────────────→ Scheduler (planner 단위로 조율)
  ├─ PlanGroup A (Content A)
  ├─ PlanGroup B (Content B)
  └─ PlanGroup C (Content C)
```

**핵심**: 단순히 plan_group을 단일 콘텐츠로 바꾸는 것이 아니라, **스케줄러 조율 책임을 plan_group → planner로 이동**

### 4.5 스케줄러 입력 변경

```typescript
// 변경 전
generatePlans(planGroup: PlanGroup, contents: PlanContent[]): ScheduledPlan[]

// 변경 후
generatePlans(planner: Planner, planGroups: PlanGroup[]): ScheduledPlan[]
// 각 planGroup은 단일 콘텐츠, planner가 전체 조율
```

---

## 5. 스키마 변경 계획

### 5.1 planners 테이블 변경

```sql
-- scheduler_options 컬럼 추가 (plan_groups에서 이동)
ALTER TABLE planners ADD COLUMN IF NOT EXISTS scheduler_options JSONB;

-- 기존 데이터 마이그레이션
UPDATE planners p
SET scheduler_options = (
  SELECT pg.scheduler_options
  FROM plan_groups pg
  WHERE pg.planner_id = p.id
    AND pg.scheduler_options IS NOT NULL
  ORDER BY pg.created_at DESC
  LIMIT 1
)
WHERE p.scheduler_options IS NULL;
```

### 5.2 plan_groups 테이블 변경

```sql
-- 단일 콘텐츠 컬럼 추가
ALTER TABLE plan_groups ADD COLUMN content_type VARCHAR;
ALTER TABLE plan_groups ADD COLUMN content_id UUID;
ALTER TABLE plan_groups ADD COLUMN master_content_id UUID;
ALTER TABLE plan_groups ADD COLUMN start_range INTEGER;
ALTER TABLE plan_groups ADD COLUMN end_range INTEGER;
ALTER TABLE plan_groups ADD COLUMN start_detail_id UUID;
ALTER TABLE plan_groups ADD COLUMN end_detail_id UUID;

-- 단일 콘텐츠 모드 플래그 (마이그레이션 중 구분용)
ALTER TABLE plan_groups ADD COLUMN is_single_content BOOLEAN DEFAULT false;

-- planner_id NOT NULL 제약 (마이그레이션 후)
-- ALTER TABLE plan_groups ALTER COLUMN planner_id SET NOT NULL;
```

### 5.3 데이터 마이그레이션 스크립트

```sql
-- 1. 기존 1:N plan_group을 1:1로 분할
WITH multi_content_groups AS (
  SELECT pg.id, pg.planner_id, pg.student_id, pg.tenant_id,
         pg.period_start, pg.period_end, pg.status,
         pc.content_type, pc.content_id, pc.master_content_id,
         pc.start_range, pc.end_range,
         pc.display_order
  FROM plan_groups pg
  JOIN plan_contents pc ON pg.id = pc.plan_group_id
  WHERE pg.is_single_content = false
)
INSERT INTO plan_groups (
  planner_id, student_id, tenant_id,
  period_start, period_end, status,
  content_type, content_id, master_content_id,
  start_range, end_range,
  is_single_content, name
)
SELECT
  planner_id, student_id, tenant_id,
  period_start, period_end, status,
  content_type, content_id, master_content_id,
  start_range, end_range,
  true,
  CONCAT('콘텐츠 ', display_order)  -- 임시 이름
FROM multi_content_groups;

-- 2. student_plan 참조 업데이트
-- (새로 분할된 plan_group_id로 매핑)

-- 3. 기존 plan_group 비활성화 (soft delete)
UPDATE plan_groups
SET deleted_at = NOW()
WHERE is_single_content = false
  AND id IN (SELECT DISTINCT plan_group_id FROM plan_contents);
```

---

## 6. 코드 변경 영향 범위

### 6.1 파일 영향 범위 요약

| 영역 | 파일 수 | 변경 내용 |
|------|--------|----------|
| **스케줄러** | ~10개 | 입력을 planner + planGroups로 변경 |
| **plan_group 생성** | ~15개 | planner_id 필수화, 콘텐츠 정보 이동 |
| **위자드 UI** | ~10개 | 여러 콘텐츠 → 여러 plan_group 생성 |
| **데이터 조회** | ~20개 | planner 기준 집계로 변경 |
| **plan_contents 관련** | ~30개 | 테이블 deprecation 또는 제거 |
| **총계** | ~85개 | |

### 6.2 핵심 수정 파일 목록

#### 스케줄러 (최우선)

```
lib/plan/scheduler.ts
lib/plan/1730TimetableLogic.ts
lib/domains/plan/services/adaptiveScheduler.ts
lib/plan/generators/planDataPreparer.ts
lib/scheduler/SchedulerEngine.ts (있다면)
```

#### 플랜 생성

```
lib/domains/plan/actions/plan-groups/create.ts
lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts
lib/domains/admin-plan/actions/unifiedPlanCreate.ts
lib/domains/admin-plan/actions/batchAIPlanGeneration.ts
lib/domains/camp/actions/student.ts
```

#### 데이터 레이어

```
lib/data/planGroups/contents.ts (deprecation)
lib/data/planGroups/core.ts
lib/domains/plan/repository.ts
lib/data/planContents.ts
```

#### 타입 정의

```
lib/types/plan/domain.ts
lib/data/planGroups/types.ts
lib/domains/plan/types.ts
lib/domains/admin-plan/actions/planners.ts
```

#### UI 컴포넌트

```
app/(student)/plan/new-group/_components/PlanGroupWizard.tsx
app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts
app/(admin)/admin/plan-creation/
```

---

## 7. 구현 단계

### Phase 1: 기반 구축 (2주)

**목표**: 새 구조의 기반을 마련하되 기존 기능 유지

```markdown
[ ] 1.1 planners 테이블에 scheduler_options 컬럼 추가
[ ] 1.2 plan_groups 테이블에 단일 콘텐츠 컬럼 추가
[ ] 1.3 Planner 타입 확장 (scheduler_options 포함)
[ ] 1.4 PlanGroup 타입 확장 (content 필드 추가)
[ ] 1.5 is_single_content 플래그 추가 (하위 호환성)
[ ] 1.6 마이그레이션 파일 작성
```

**결과**: 새 필드 추가됨, 기존 코드는 그대로 동작

### Phase 2: 스케줄러 리팩토링 (2주)

**목표**: 스케줄러가 planner 단위로 조율하도록 변경

```markdown
[ ] 2.1 스케줄러 입력 타입 변경 (PlannerWithPlanGroups)
[ ] 2.2 generatePlans 함수 시그니처 변경
[ ] 2.3 블록 배정 로직 수정 (planner 하위 전체 고려)
[ ] 2.4 전략/취약과목 배정 로직 수정
[ ] 2.5 복습일 처리 로직 수정
[ ] 2.6 기존 호출부 어댑터 추가 (하위 호환)
[ ] 2.7 스케줄러 단위 테스트 업데이트
```

**결과**: 스케줄러가 새 구조 지원, 기존 구조도 어댑터로 동작

### Phase 3: 생성 로직 전환 (2주)

**목표**: 새로 생성되는 plan_group은 단일 콘텐츠

```markdown
[ ] 3.1 위자드에서 여러 콘텐츠 선택 → 여러 plan_group 생성
[ ] 3.2 createPlanGroupAction 수정 (단일 콘텐츠)
[ ] 3.3 관리자 배치 생성 수정
[ ] 3.4 캠프 템플릿 생성 수정
[ ] 3.5 plan_contents 사용 부분 deprecation 시작
[ ] 3.6 UI 테스트
```

**결과**: 새 데이터는 단일 콘텐츠 구조, 레거시는 기존대로

### Phase 4: 레거시 마이그레이션 (유지보수 윈도우)

**목표**: 기존 1:N 데이터를 1:1로 분할

```markdown
[ ] 4.1 마이그레이션 스크립트 완성 및 테스트
[ ] 4.2 백업 생성
[ ] 4.3 plan_group 분할 (1:N → 1:1)
[ ] 4.4 student_plan 참조 업데이트
[ ] 4.5 scheduler_options planner로 이동
[ ] 4.6 plan_contents 테이블 데이터 검증
[ ] 4.7 인덱스 최적화
[ ] 4.8 롤백 테스트
```

**결과**: 모든 데이터가 새 구조로 전환

### Phase 5: 정리 (1주)

**목표**: 레거시 코드 제거

```markdown
[ ] 5.1 plan_contents 관련 코드 제거
[ ] 5.2 하위 호환 어댑터 제거
[ ] 5.3 is_single_content 플래그 제거
[ ] 5.4 테스트 업데이트
[ ] 5.5 문서 업데이트
```

---

## 8. 기능 인벤토리

### 8.1 학생 플랜 영역 (~45개)

#### 플랜 목록 및 조회

- [ ] 플랜 목록 페이지 (`/plan`)
- [ ] 플랜 그룹 상세 (`/plan/group/[id]`)
- [ ] 플랜 캘린더 (`/plan/calendar`)
- [ ] 플랜 통계 (`/plan/stats`)

#### 플랜 생성 및 관리

- [ ] 새 플랜 그룹 생성 - 7단계 위자드 (`/plan/new-group`)
- [ ] 플랜 그룹 편집 (`/plan/group/[id]/edit`)
- [ ] 빠른 플랜 생성 (`/plan/quick-create`)
- [ ] 콘텐츠 추가 (`/plan/content-add`)

#### 플랜 조정 및 재스케줄링

- [ ] 플랜 재스케줄 (`/plan/group/[id]/reschedule`)
- [ ] 재스케줄 히스토리 조회
- [ ] 플랜 순서 변경 (`updatePlanOrder`)
- [ ] 플랜 범위 조정 (`adjustPlanRanges`)

#### Server Actions

- [ ] `createPlanGroupAction`
- [ ] `savePlanGroupDraftAction`
- [ ] `updatePlanGroupAction`
- [ ] `deletePlanGroupAction`
- [ ] `generatePlansWithServicesAction`
- [ ] `rescheduleStudentPlanGroupAction`

### 8.2 관리자 플랜 영역 (~55개)

#### 플랜 생성

- [ ] 통합 플랜 생성 (`createUnifiedPlan`)
- [ ] 배치 AI 플랜 생성 (`batchCreateAIPlanGroupsAction`)
- [ ] 콘텐츠 기반 플랜 (`createPlanFromContent`)
- [ ] Ad-hoc 플랜 (`createAdHocPlan`)

#### 플래너 관리

- [ ] 플래너 CRUD (`createPlannerAction`, `updatePlannerAction`, etc.)
- [ ] 플래너 제외일 관리
- [ ] 플래너 학원 일정 관리

#### 플랜 관리

- [ ] 플랜 수정 (`adminUpdateStudentPlan`)
- [ ] 일괄 수정 (`adminBulkUpdatePlans`)
- [ ] 이월 처리 (`runCarryoverForStudent`)

### 8.3 캠프 영역 (~15개)

- [ ] 캠프 템플릿 CRUD
- [ ] 캠프 초대 발송
- [ ] 학생 캠프 참여 (`submitCampParticipation`)
- [ ] 캠프 진행 상황 추적
- [ ] 캠프 재스케줄링

### 8.4 Today/실행 영역 (~30개)

#### 타이머

- [ ] 타이머 시작/중지/완료
- [ ] 학습 일시정지/재개
- [ ] 타이머 리셋

#### 컨테이너

- [ ] 컨테이너 플랜 조회 (`getTodayContainerPlans`)
- [ ] 일간/주간 이동
- [ ] 하루 종료 처리

#### 동기화

- [ ] 다중 기기 동기화
- [ ] 세션 인수

### 8.5 공통 서비스 (~25개)

#### 스케줄러

- [ ] `adaptiveScheduler`
- [ ] `intelligentSchedulingOrchestrator`
- [ ] `1730TimetableLogic`

#### 검증

- [ ] `planValidationService`
- [ ] `slotValidationService`

#### 기타

- [ ] `progressCalculator`
- [ ] `cacheInvalidation`
- [ ] Cold Start 추천

---

## 9. 리스크 및 대응

### 9.1 주요 리스크

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| **데이터 마이그레이션 실패** | 중 | 높음 | 철저한 백업, 롤백 스크립트 준비 |
| **스케줄러 버그** | 높음 | 높음 | 단계적 전환, A/B 테스트, 기존 어댑터 유지 |
| **성능 저하** | 중 | 중 | 인덱스 최적화, 쿼리 분석 |
| **기능 누락** | 중 | 높음 | 기능 인벤토리 체크리스트 활용 |
| **UI 깨짐** | 중 | 중 | 컴포넌트별 테스트 |

### 9.2 롤백 계획

| Phase | 롤백 방법 |
|-------|----------|
| Phase 1-2 | 새 컬럼만 추가, 기존 동작 유지 → 롤백 불필요 |
| Phase 3 | `is_single_content` 플래그로 구분 → 플래그 기반 분기 |
| Phase 4 | 마이그레이션 전 전체 백업 → DB point-in-time 복원 |

---

## 10. 검증 체크리스트

### 10.1 스케줄러 검증

```markdown
[ ] 블록 효율성 100% 유지 (시간 낭비 없음)
[ ] 전략과목 주당 N일 배정 정확
[ ] 취약과목 전체 학습일 배정 정확
[ ] 복습일 시간 계산 정확
[ ] 복습의 복습 (additional_period) 정상
[ ] 제외일 처리 정상
[ ] 학원 일정 반영 정상
```

### 10.2 데이터 정합성 검증

```markdown
[ ] student_plan 총 개수 불변
[ ] 날짜별 학습량 합계 불변
[ ] 콘텐츠별 총 범위 불변
[ ] planner-plan_group 관계 정확
[ ] orphan 레코드 없음
```

### 10.3 UI/UX 검증

```markdown
[ ] 학생 위자드 정상 동작 (7단계)
[ ] 관리자 배치 생성 정상
[ ] 캠프 템플릿/초대 정상
[ ] Today 컨테이너 정상 (daily/weekly/unfinished)
[ ] 캘린더 표시 정상
[ ] 진행률 표시 정상
```

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-01-19 | 초안 작성 - 분석 및 설계 | Claude |

---

## 다음 단계

1. 이 문서 리뷰 및 승인
2. Phase 1 마이그레이션 파일 작성
3. 스케줄러 리팩토링 상세 설계
4. 테스트 계획 수립
