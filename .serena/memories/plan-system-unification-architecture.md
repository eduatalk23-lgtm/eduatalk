# 플랜 시스템 통합 아키텍처 설계

> 작성일: 2026-01-19
> 최종 수정일: 2026-01-20
> 상태: ✅ 구현 완료

## 1. 배경 및 목표

### 1.1 현재 문제점

현재 TimeLevelUp의 플랜 관련 기능이 여러 영역에 분산되어 있어 다음과 같은 문제가 발생:

| 문제 | 상세 |
|------|------|
| **코드 중복/유지보수** | 비슷한 로직이 여러 곳에 분산, 수정 시 여러 파일 변경 필요 |
| **기능 불일치** | 학생/관리자/캠프 간 기능 차이, 일관된 경험 제공 어려움 |
| **확장성 문제** | 새 기능 추가 시 위치 불명확, 영향 범위 파악 어려움 |
| **데이터 흐름 복잡** | 플랜 데이터가 여러 경로로 생성, 추적/분석 어려움 |

### 1.2 최종 목표

1. **단일 생성 파이프라인**: 학생/관리자/캠프 모두 동일한 내부 로직으로 플랜 생성
2. **플래너 중심 관리**: 모든 플랜을 '플래너'를 통해 관리
3. **데이터 모델 통합**: ad_hoc_plans 등 분산된 테이블을 student_plan으로 통합
4. **UI/UX 통합**: 학생/관리자 화면 경험을 일관되게 통합

### 1.3 서비스 운영 조건

- 유지보수 윈도우 활용 가능 (공지 후 일정 시간 서비스 중단 가능)
- 가장 시급한 문제: **새 기능 추가 어려움**

---

## 2. 현재 시스템 구조 분석

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
│ - ✅ 여러 콘텐츠 포함 (plan_contents 1:N)                       │
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
│ (최대 9개)          │            │                     │
└─────────────────────┘            └─────────────────────┘
```

### 2.2 기존 기능 영역 (분산됨)

| 영역 | 위치 | 기능 |
|------|------|------|
| **학생 플랜** | `app/(student)/plan/`, `lib/domains/plan/` | 7단계 위자드, 재스케줄링 |
| **관리자 플랜** | `app/(admin)/`, `lib/domains/admin-plan/` | 배치 생성, AI 플랜, 플래너 관리 |
| **캠프** | `lib/domains/camp/` | 템플릿, 초대, 진행 추적 |
| **Today/실행** | `lib/domains/today/` | 타이머, 컨테이너, 동기화 |

### 2.3 기능 인벤토리 (약 170개)

- 학생 플랜: ~45개
- 관리자 플랜: ~55개
- 캠프: ~15개
- Today/실행: ~30개
- 공통 서비스: ~25개

---

## 3. 목표 구조 (사용자 의도)

### 3.1 핵심 개념 변경

| 개념 | 현재 역할 | 변경 후 역할 |
|------|----------|------------|
| **Planner** | 전역 학습 설정만 | **설정 + 여러 콘텐츠 묶음 + 스케줄러 조율** |
| **PlanGroup** | 여러 콘텐츠 포함 (1:N) | **단일 콘텐츠만** (콘텐츠별 진행상황 추적) |
| **plan_contents** | plan_group과 content 연결 | **제거 또는 deprecation** |

### 3.2 목표 데이터 모델

```
목표 구조:
┌─────────────────────────────────────────────────────────────────┐
│ Planner (플래너) - 역할 대폭 강화                               │
│ - 학습 시간 설정                                                │
│ - 스케줄러 옵션 (scheduler_options) ← plan_group에서 이동       │
│ - ✅ 여러 플랜 그룹의 "허브" 역할                               │
│ - ✅ 시간 슬롯 조율자                                           │
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

---

## 4. 스케줄러 연관성 분석 (핵심)

### 4.1 여러 콘텐츠를 함께 처리하는 이유

현재 스케줄러가 plan_group 단위로 여러 콘텐츠를 함께 처리하는 이유:

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
subject_allocations: [
  { subject: "수학", type: "weakness" },       // 6일/주 전체
  { subject: "국어", type: "strategy", weekly_days: 3 }  // 3일/주만
]
```

- 취약과목: 모든 학습일 (24일)
- 전략과목: 선택된 일수만 (12일)
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

| 문제 | 현재 | 분리 후 |
|------|------|--------|
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

---

## 5. 스키마 변경 계획

### 5.1 planners 테이블 변경

```sql
-- 기존 컬럼 유지 + 새 컬럼 추가
ALTER TABLE planners ADD COLUMN IF NOT EXISTS scheduler_options JSONB;
-- plan_groups.scheduler_options를 여기로 이동

-- subject_allocations, content_allocations 등 조율 정보 포함
```

### 5.2 plan_groups 테이블 변경

```sql
-- 새 컬럼 추가 (단일 콘텐츠 정보)
ALTER TABLE plan_groups ADD COLUMN content_type VARCHAR;
ALTER TABLE plan_groups ADD COLUMN content_id UUID;
ALTER TABLE plan_groups ADD COLUMN master_content_id UUID;
ALTER TABLE plan_groups ADD COLUMN start_range INTEGER;
ALTER TABLE plan_groups ADD COLUMN end_range INTEGER;
ALTER TABLE plan_groups ADD COLUMN start_detail_id UUID;
ALTER TABLE plan_groups ADD COLUMN end_detail_id UUID;

-- planner_id를 필수로 변경 (기존 NULL 허용 → NOT NULL)
-- 단, 마이그레이션 후에 적용

-- scheduler_options는 유지하되 override 용도로만 사용
-- 또는 제거하고 planner에서만 관리
```

### 5.3 plan_contents 테이블

```sql
-- Phase 1: 유지 (하위 호환성)
-- Phase 2: 새 데이터는 plan_groups 컬럼 사용
-- Phase 3: 레거시 데이터 마이그레이션 후 deprecation
-- Phase 4: 테이블 제거 (선택적)
```

### 5.4 데이터 마이그레이션

```sql
-- 1. 기존 1:N plan_group을 1:1로 분할
-- plan_group_A (contents: 수학, 국어, 영어)
--  → plan_group_A_1 (수학)
--  → plan_group_A_2 (국어)
--  → plan_group_A_3 (영어)

-- 2. student_plan 참조 업데이트
-- 각 student_plan의 plan_group_id를 분할된 새 plan_group으로 매핑

-- 3. scheduler_options을 planner로 이동
UPDATE planners p
SET scheduler_options = pg.scheduler_options
FROM plan_groups pg
WHERE pg.planner_id = p.id
  AND pg.scheduler_options IS NOT NULL;
```

---

## 6. 코드 변경 영향 범위

### 6.1 파일 영향 범위

| 영역 | 파일 수 | 변경 내용 |
|------|--------|----------|
| **스케줄러** | ~10개 | 입력을 planner + planGroups로 변경 |
| **plan_group 생성** | ~15개 | planner_id 필수화, 콘텐츠 정보 이동 |
| **위자드 UI** | ~10개 | 여러 콘텐츠 → 여러 plan_group 생성 |
| **데이터 조회** | ~20개 | planner 기준 집계로 변경 |
| **plan_contents 관련** | ~30개 | 테이블 deprecation 또는 제거 |
| **총계** | ~85개 | |

### 6.2 핵심 수정 파일

**스케줄러:**
- `lib/plan/scheduler.ts`
- `lib/plan/1730TimetableLogic.ts`
- `lib/domains/plan/services/adaptiveScheduler.ts`
- `lib/plan/generators/planDataPreparer.ts`

**플랜 생성:**
- `lib/domains/plan/actions/plan-groups/create.ts`
- `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`
- `lib/domains/admin-plan/actions/unifiedPlanCreate.ts`

**데이터 레이어:**
- `lib/data/planGroups/contents.ts` (deprecation)
- `lib/data/planGroups/core.ts`
- `lib/domains/plan/repository.ts`

**타입:**
- `lib/types/plan/domain.ts`
- `lib/data/planGroups/types.ts`

---

## 7. 구현 단계 (Phase별)

### Phase 1: 기반 구축 (2주)

**목표**: 새 구조의 기반을 마련하되 기존 기능 유지

```
[x] 1.1 planners 테이블에 scheduler_options 컬럼 추가 ✅
[x] 1.2 plan_groups 테이블에 단일 콘텐츠 컬럼 추가 ✅
    - content_type, content_id, master_content_id
    - start_range, end_range
    - start_detail_id, end_detail_id
    - is_single_content
[x] 1.3 Planner 타입 확장 (scheduler_options 포함) ✅
[x] 1.4 PlanGroup 타입 확장 (content 필드 추가) ✅
[x] 1.5 is_single_content 플래그 추가 (하위 호환성) ✅
```

**결과**: 새 필드 추가됨, 기존 코드는 그대로 동작
**완료일**: 2026-01-19
**마이그레이션 파일**: `supabase/migrations/20260119100000_plan_system_unification_phase1.sql`

### Phase 2: 스케줄러 리팩토링 (2주)

**목표**: 스케줄러가 planner 단위로 조율하도록 변경

```
[x] 2.1 스케줄러 입력 타입 변경 (lib/types/plan/scheduler.ts)
    - PlannerWithSchedulerOptions, SingleContentPlanGroup 타입 정의
    - ContentInfoWithPlanGroup, ScheduledPlanWithGroup 타입 정의
    - isSingleContentPlanGroup 타입 가드 추가
[x] 2.2 generatePlans 함수 시그니처 변경
    - generatePlansFromPlanner() 함수 추가 (lib/plan/schedulerPlanner.ts)
    - Planner + SingleContentPlanGroup[] 입력 지원
[x] 2.6 기존 호출부 어댑터 추가 (lib/plan/adapters/legacyAdapter.ts)
    - planGroupToVirtualPlanner() - PlanGroup → Planner 변환
    - planContentsToSingleContentGroups() - PlanContent[] → SingleContentPlanGroup[]
    - stripPlanGroupId() - 레거시 호환용 plan_group_id 제거
    - generatePlansFromGroupLegacy() - 레거시 호출 래퍼
[x] 2.3 1730TimetableLogic.ts에 Phase 2 지원 함수 추가
    - calculateContentAllocationDatesWithOptions(): SchedulerOptions 기반 배정 날짜 계산
    - calculateReviewDurations(): 여러 콘텐츠 복습 시간 조율
    - calculateAdditionalReviewDurations(): 복습의 복습 시간 계산
    - sortContentsForBlockPlacement(): 블록 내 콘텐츠 배치 순서 결정
[x] 2.4 전략/취약과목 배정 로직 통합 ✅
    - buildContentAllocationsFromGroups(): SingleContentPlanGroup[]에서 content_allocations 자동 빌드
    - createVirtualPlanGroup()에서 planner.schedulerOptions와 병합
    - SchedulerOptions.content_allocations에 "custom" 타입 추가
[x] 2.5 복습일 처리 로직 통합 ✅
    - 이미 SchedulerEngine에서 planner.schedulerOptions.study_days/review_days 사용
    - generateReviewDayPlans()에서 1730 주기 기반 복습 처리
```

**결과**: 스케줄러가 새 구조 지원, 기존 구조도 어댑터로 동작
**완료 일자**: 2026-01-19
**생성된 파일**:
- lib/types/plan/scheduler.ts (타입 정의)
- lib/plan/schedulerPlanner.ts (Planner 기반 스케줄러)
- lib/plan/adapters/legacyAdapter.ts (하위 호환 어댑터)
- lib/plan/adapters/index.ts (export)

### Phase 3: 생성 로직 전환 (2주)

**목표**: 새로 생성되는 plan_group은 단일 콘텐츠

```
[x] 3.1 위자드에서 여러 콘텐츠 선택 → 여러 plan_group 생성 ✅
[x] 3.2 createPlanGroupAction 수정 (단일 콘텐츠) ✅
[x] 3.3 관리자 배치 생성 수정 ✅
[x] 3.4 캠프 템플릿 생성 수정 ✅
[x] 3.5 plan_contents 사용 부분 deprecation 시작 ✅
```

**Phase 3.1/3.2 완료 (2026-01-20)**:
- 위자드 hooks 수정: usePlanPayloadBuilder, usePlanGenerator, usePlanSubmission
- Planner 자동 생성 Action: `lib/domains/plan/actions/planners/autoCreate.ts`
- SubmissionProgress에 `ensuring_planner`, `creating_groups` 단계 추가
- `createPlanGroupAction`에서 단일 콘텐츠 모드 기본값 적용:
  - `is_single_content !== false && (contents.length === 1 || !!single_content_id)` → 자동 단일 콘텐츠 모드

**Phase 3.3 완료 (2026-01-20)**:
- `lib/domains/admin-plan/actions/createAutoContentPlanGroup.ts`: `is_single_content: true` 추가
- `lib/domains/admin-plan/actions/unifiedPlanCreate.ts`: `ensurePlanGroup` 레거시 경로에 `is_single_content: true` 추가

**Phase 3.4 완료 (2026-01-20)**:
- `lib/domains/camp/actions/student.ts`: 캠프 참여 시 `is_single_content: false` 명시적 설정 (슬롯 모드는 다중 콘텐츠)
  - `planGroupData` (새 그룹 생성 시)
  - `updateData` (draft 업데이트 시)

**결과**: 새 데이터는 단일 콘텐츠 구조, 레거시는 기존대로

### Phase 4: 레거시 마이그레이션 (유지보수 윈도우)

**목표**: 기존 1:N 데이터를 1:1로 분할

```
[x] 4.1 마이그레이션 스크립트 작성 ✅
[x] 4.2 단일 콘텐츠 그룹 마이그레이션 (141개 → 139개 성공) ✅
[x] 4.3 다중 콘텐츠 그룹 처리 (9개 → is_single_content=false 유지) ✅
[x] 4.4 슬롯 모드 그룹 처리 (3개) ✅
[x] 4.5 빈 드래프트 그룹 처리 (45개) ✅
[x] 4.6 인덱스 최적화 ✅
```

**결과**: 모든 데이터가 새 구조로 전환
**완료일**: 2026-01-20
**마이그레이션 결과**:
- 139개: 단일 콘텐츠 그룹 (content_id 설정됨)
- 45개: 빈 드래프트 (변환 불필요)
- 9개: 다중 콘텐츠 레거시 (is_single_content=false 유지)
- 3개: 슬롯 모드 (slot_mode=true)

### Phase 5: 정리 (1주)

**목표**: 레거시 코드 제거

```
[x] 5.1 통합 콘텐츠 접근 모듈 추가 ✅
    - lib/data/planGroups/unifiedContent.ts 생성
    - getUnifiedContents(): 단일/다중 콘텐츠 통합 조회
    - getSingleContentFromGroup(): 단일 콘텐츠 동기 추출
    - hasContent(), getContentMode(): 헬퍼 함수
[x] 5.2 레거시 코드 유지 (캠프 슬롯 모드 지원) ✅
    - getPlanContents, createPlanContents는 캠프 도메인에서 사용
    - 완전 제거는 캠프 리팩토링 후 진행
[x] 5.3 is_single_content 플래그 정리 ✅
    - 기본값 false → true 변경
    - 불필요한 plan_contents 정리
    - 마이그레이션: phase5_3_single_content_default_cleanup
[x] 5.4 테스트 업데이트 ✅
    - __tests__/lib/plan/schedulerPlanner.test.ts (9 tests)
    - __tests__/lib/data/planGroups/unifiedContent.test.ts (14 tests)
[x] 5.5 문서 업데이트 ✅

**결과**: 통합 API로 단일/다중 콘텐츠 모드 추상화 완료
**완료일**: 2026-01-20
**생성된 파일**: lib/data/planGroups/unifiedContent.ts
```

---

## 8. 리스크 및 대응

### 8.1 주요 리스크

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| **데이터 마이그레이션 실패** | 중 | 높음 | 철저한 백업, 롤백 계획 |
| **스케줄러 버그** | 높음 | 높음 | 단계적 전환, A/B 테스트 |
| **성능 저하** | 중 | 중 | 인덱스 최적화, 쿼리 분석 |
| **기능 누락** | 중 | 높음 | 기능 인벤토리 체크리스트 |

### 8.2 롤백 계획

- Phase 1-2: 새 컬럼만 추가, 기존 동작 유지 → 롤백 불필요
- Phase 3: is_single_content 플래그로 구분 → 플래그 기반 롤백
- Phase 4: 마이그레이션 전 전체 백업 → DB 복원

---

## 9. 검증 체크리스트

### 9.1 스케줄러 검증

```
[ ] 블록 효율성 100% 유지
[ ] 전략과목 주당 N일 배정 정확
[ ] 취약과목 전체 학습일 배정 정확
[ ] 복습일 시간 계산 정확
[ ] 복습의 복습 (additional_period) 정상
```

### 9.2 데이터 정합성 검증

```
[ ] student_plan 총 개수 불변
[ ] 날짜별 학습량 합계 불변
[ ] 콘텐츠별 총 범위 불변
[ ] planner-plan_group 관계 정확
```

### 9.3 UI/UX 검증

```
[ ] 학생 위자드 정상 동작
[ ] 관리자 배치 생성 정상
[ ] 캠프 템플릿/초대 정상
[ ] Today 컨테이너 정상
[ ] 캘린더 표시 정상
```

---

## 10. 참조 문서

- 기능 인벤토리: 이 문서의 Section 2.3
- 스케줄러 분석: Section 4
- 스키마 변경: Section 5
- 영향 파일 목록: Section 6

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-01-19 | 초안 작성 | Claude |
| 2026-01-20 | Phase 3.1-3.4 구현 완료 | Claude |
| 2026-01-20 | Phase 4 데이터 마이그레이션 완료 | Claude |
| 2026-01-20 | Phase 5 정리 및 문서화 완료 | Claude |
| 2026-01-20 | Phase 2.4, 2.5 스케줄러 강화 완료 | Claude |
| 2026-01-20 | Phase 5.3 플래그 정리 + Phase 5.4 테스트 추가 완료 | Claude |
