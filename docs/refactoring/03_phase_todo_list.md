> ⚠️ **DEPRECATED — 2025-12-09 리팩토링 TODO**
>
> 당시 Phase 1~3 리팩토링의 TODO 체크리스트였으며 **이미 완료/초과 진행**되었습니다.
> 현재 프로젝트 구조: [`ARCHITECTURE.md`](../ARCHITECTURE.md)
> 도메인 규칙: `lib/domains/*/CLAUDE.md`

---

# 3. Phase별 TODO 리스트

## 작성일: 2025-12-09

---

## 📋 개요

통합 리팩토링을 3개의 Phase로 나누어 단계별로 진행합니다.

---

## 🟢 Phase 1: 도메인 정리·안전망 구축

**목표**: 기존 코드 변경 없이 안전한 기반 마련

**예상 기간**: 1-2일

### TODO 체크리스트

#### 1.1 RLS 정책 + updated_at 트리거 (마이그레이션)

- [x] **[P1-1]** `student_plan` RLS 정책 마이그레이션 작성 ✅ (2025-12-09)

  - 파일: `supabase/migrations/20251209000001_add_student_plan_rls_and_triggers.sql`
  - 학생 정책: `student_id = auth.uid()`
  - 관리자 정책: 같은 `tenant_id` 내 접근
  - 위험도: 🔴 높음 (기존 쿼리 영향)

- [x] **[P1-2]** `updated_at` 자동 업데이트 트리거 작성 ✅ (2025-12-09)
  - 파일: `supabase/migrations/20251209000001_add_student_plan_rls_and_triggers.sql` (P1-1과 통합)
  - 대상 테이블: `student_plan`, `plan_groups`, `plan_group_contents`
  - 위험도: 🟢 낮음

#### 1.2 더미 콘텐츠 상수 중앙화

- [x] **[P1-3]** 중앙 상수 파일 생성 ✅ (2025-12-09)

  - 파일: `lib/constants/plan.ts`
  - 내용:
    ```typescript
    export const DUMMY_NON_LEARNING_CONTENT_ID =
      "00000000-0000-0000-0000-000000000000";
    export const DUMMY_SELF_STUDY_CONTENT_ID =
      "00000000-0000-0000-0000-000000000001";
    ```
  - 위험도: 🟢 낮음

- [x] **[P1-4]** `isDummyContent()` 헬퍼 함수 생성 ✅ (2025-12-09)

  - 파일: `lib/utils/planUtils.ts` (신규)
  - 추가 헬퍼: `isNonLearningContent()`, `isSelfStudyContent()`, `getDummyContentMetadata()`
  - 위험도: 🟢 낮음

- [x] **[P1-5]** 기존 하드코딩 제거 및 import 교체 ✅ (2025-12-09)

  - 대상 파일:
    - `lib/plan/generators/planDataPreparer.ts`
    - `app/(student)/actions/plan-groups/plans.ts`
  - 위험도: 🟡 중간

- [ ] **[P1-6]** 더미 콘텐츠 DB row 보장 시드 스크립트 (SKIP: 런타임에서 처리 중)
  - 현재 `plans.ts`에서 더미 콘텐츠 row를 런타임에 생성하므로 별도 시드 스크립트 불필요
  - 위험도: 🟢 낮음

#### 1.3 완료 기준 통일 + metrics 모듈 인터페이스 설계

- [x] **[P1-7]** 완료 기준 상수 정의 ✅ (2025-12-09)

  - 파일: `lib/constants/plan.ts`
  - 내용: `PLAN_COMPLETION_CRITERIA` 상수 추가
  - 위험도: 🟢 낮음

- [x] **[P1-8]** `isCompletedPlan()` 헬퍼 함수 생성 ✅ (2025-12-09)

  - 파일: `lib/utils/planUtils.ts`
  - 추가 헬퍼: `filterLearningPlans()`, `countCompletedLearningPlans()`, `calculateCompletionRate()`
  - 위험도: 🟢 낮음

- [x] **[P1-9]** `todayProgress.ts` 수정 ✅ (2025-12-09)

  - 파일: `lib/metrics/todayProgress.ts`
  - 변경: `isCompletedPlan()`, `filterLearningPlans()` 헬퍼 사용
  - 위험도: 🔴 높음 (통계 변동 가능)

- [x] **[P1-10]** `getPlanCompletion.ts` 수정 ✅ (2025-12-09)

  - 파일: `lib/metrics/getPlanCompletion.ts`
  - 변경: `isCompletedPlan()`, `filterLearningPlans()` 헬퍼 사용
  - 위험도: 🔴 높음 (통계 변동 가능)

- [x] **[P1-11]** 비학습/자율학습 집계 정책 문서화 ✅ (2025-12-09)
  - 파일: `docs/refactoring/metrics_policy.md`
  - 위험도: 🟢 낮음 (문서만)

### Phase 1 영향 범위

| 카테고리     | 파일/테이블                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 마이그레이션 | `supabase/migrations/20251209000001_*.sql`, `20251209000002_*.sql`                                                                                          |
| TypeScript   | `lib/constants/plan.ts`, `lib/utils/planUtils.ts`                                                                                                           |
| 수정 대상    | `lib/plan/generators/planDataPreparer.ts`, `app/(student)/actions/plan-groups/plans.ts`, `lib/metrics/todayProgress.ts`, `lib/metrics/getPlanCompletion.ts` |
| 문서         | `docs/refactoring/metrics_policy.md`                                                                                                                        |

### Phase 1 테스트 시나리오

1. RLS 테스트

   - [ ] 학생 A가 학생 B의 플랜 조회 불가 확인
   - [ ] 관리자가 같은 테넌트 내 학생 플랜 조회 가능 확인
   - [ ] 다른 테넌트 플랜 접근 불가 확인

2. 트리거 테스트

   - [ ] `student_plan` 업데이트 시 `updated_at` 자동 갱신 확인

3. 완료 기준 테스트
   - [ ] 기존 통계와 신규 통계 비교 (변동 범위 확인)

---

## 🟡 Phase 2: 플랜 구조·CRUD 리팩토링

**목표**: 논리 플랜 개념 도입 및 플랜그룹 화면 개선

**예상 기간**: 3-5일

**의존성**: Phase 1 완료

### TODO 체크리스트

#### 2.1 plan_group_items 테이블 도입

- [x] **[P2-1]** `plan_group_items` 테이블 마이그레이션 ✅ (2025-12-09)

  - 파일: `supabase/migrations/20251209000002_create_plan_group_items.sql`
  - 추가 필드: `split_strategy`, `is_required`, `metadata` (확장성 확보)
  - 위험도: 🟡 중간 (신규 테이블)

- [x] **[P2-2]** `origin_plan_item_id` 컬럼 추가 ✅ (2025-12-09)

  - 파일: `supabase/migrations/20251209000002_create_plan_group_items.sql` (P2-1과 통합)
  - 대상: `student_plan` 테이블
  - 위험도: 🟡 중간

- [x] **[P2-3]** TypeScript 타입 정의 추가 ✅ (2025-12-09)
  - 파일: `lib/types/plan.ts`
  - 타입: `PlanGroupItem`, `PlanGroupItemInput`
  - Plan 타입에 `origin_plan_item_id` 필드 추가
  - 위험도: 🟢 낮음

#### 2.2 플랜그룹 화면 CRUD 개선

- [x] **[P2-4]** `plan_group_items` 데이터 레이어 생성 ✅ (2025-12-09)

  - 파일: `lib/data/planGroupItems.ts`
  - CRUD 함수: `createPlanGroupItem`, `updatePlanGroupItem`, `deletePlanGroupItem`, `getPlanGroupItems`, `createPlanGroupItems`, `deletePlanGroupItemsByGroupId`
  - 유틸: `convertPlanContentToGroupItem` (마이그레이션 용도)
  - 위험도: 🟢 낮음

- [x] **[P2-5]** Server Actions 추가 ✅ (2025-12-09)

  - 파일: `app/(student)/actions/plan-groups/items.ts` (신규)
  - 함수: `getLogicalPlans`, `createLogicalPlan`, `createLogicalPlans`, `updateLogicalPlan`, `deleteLogicalPlan`, `deleteAllLogicalPlans`
  - 권한 체크, 플랜 그룹 상태 체크 포함
  - 위험도: 🟡 중간

- [x] **[P2-6]** 플랜 생성 로직 수정 ✅ (2025-12-09)

  - 파일: `lib/data/studentPlans.ts`
  - 변경:
    - `CreatePlanInput` 타입 정의 (origin_plan_item_id 포함)
    - `createPlan` 함수에 옵션 파라미터 추가
      - `origin_plan_item_id`: 논리 플랜 연결
      - `plan_group_id`: 플랜 그룹 연결
      - `start_time`, `end_time`: 시간 정보
  - 기존 동작: 영향 없음 (옵션 파라미터)
  - 위험도: 🔴 높음 → 🟢 낮음 (하위 호환)

- [x] **[P2-7]** 플랜그룹 상세 화면 수정 ✅ (2025-12-09)
  - 파일:
    - `app/(student)/plan/group/[id]/_components/LogicalPlanList.tsx` (신규)
    - `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx` (수정)
  - 변경:
    - 논리 플랜 관리 컴포넌트 (LogicalPlanList) 생성
    - 추가/수정/삭제 폼 모달 구현
    - 플랜그룹 상세 화면에 "논리 플랜" 탭 추가 (탭 ID: 8)
  - 위험도: 🟡 중간

#### 2.3 student_plan 수정 범위 제한

- [x] **[P2-8]** `updatePlan` 함수 제한 추가 ✅ (2025-12-09)

  - 파일: `lib/data/studentPlans.ts`
  - 변경:
    - `AllowedPlanUpdates` 타입 정의 (허용 필드)
    - `ForbiddenPlanUpdateFields` 타입 정의 (금지 필드)
    - `updatePlanSafe()` 함수 추가 (안전한 업데이트)
    - 기존 `updatePlan()` deprecated 처리 및 경고 추가
  - 위험도: 🟡 중간

- [x] **[P2-9]** 삭제 정책 일관화 ✅ (2025-12-09)
  - 파일: `lib/data/studentPlans.ts`
  - 변경: `PLAN_DELETE_POLICY` 상수 및 삭제 정책 문서화
  - 위험도: 🟡 중간

### Phase 2 영향 범위

| 카테고리        | 파일/테이블                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| 마이그레이션    | `supabase/migrations/20251210000001_*.sql`, `20251210000002_*.sql`            |
| TypeScript 타입 | `lib/types/plan.ts`                                                           |
| 데이터 레이어   | `lib/data/planGroupItems.ts` (신규)                                           |
| Server Actions  | `app/(student)/actions/plan-groups/items.ts` (신규)                           |
| 수정 대상       | `lib/plan/scheduler.ts`, `lib/data/studentPlans.ts`, `lib/data/planGroups.ts` |
| UI 컴포넌트     | `app/(student)/plan/` 하위 파일들                                             |

### Phase 2 테스트 시나리오

1. 논리 플랜 CRUD

   - [ ] 플랜그룹 내 논리 플랜 추가/수정/삭제
   - [x] 논리 플랜 수정 시 student_plan 재생성 확인 (재조정 기능으로 통합됨 - 2025-01-22)
   - [ ] 이미 완료된 student_plan 보호 확인

2. origin_plan_item_id 연결

   - [ ] 새로 생성된 student_plan에 origin_plan_item_id 연결 확인
   - [ ] 기존 student_plan은 NULL 유지 확인

3. 삭제 정책
   - [ ] plan_group 삭제 시 관련 student_plan 처리 확인

---

## 🔴 Phase 3: 타임라인·today/캠프 최적화

**목표**: 타임라인 로직 정리 및 성능 최적화

**예상 기간**: 2-3일

**의존성**: Phase 2 완료

### TODO 체크리스트

#### 3.1 타임라인 로직 분리·정리

- [x] **[P3-1]** 타임라인 옵션 타입 정의 ✅ (2025-12-09)

  - 파일: `lib/scheduler/calculateAvailableDates.ts`
  - 변경:
    - `SchedulerMode` 타입 추가 (`'block' | 'time'`)
    - `CalculateOptions.scheduler_mode` 옵션 추가
  - 위험도: 🟡 중간

- [x] **[P3-2]** 함수 시그니처 명확화 ✅ (2025-12-09)

  - 파일: `lib/plan/assignPlanTimes.ts`
  - 변경:
    - `ContentType`, `PlanTimeInput`, `StudyTimeSlot` 타입 분리
    - `ContentDurationInfo`, `PlanEstimateInput` 타입 분리
    - 함수 JSDoc 주석 강화
  - 위험도: 🟡 중간

- [x] **[P3-3]** start_time/end_time NULL 정책 문서화 ✅ (2025-12-09)
  - 파일: `docs/refactoring/timeline_strategy.md`
  - 내용: Block/Time 모드 정의, NULL 허용 상황, 방어 처리 패턴
  - 위험도: 🟢 낮음 (문서만)

#### 3.2 today 화면 성능 최적화

- [x] **[P3-4]** today 쿼리 패턴 점검 ✅ (2025-12-09)

  - 파일: `lib/data/todayPlans.ts`
  - 결과: 이미 최적화되어 있음
    - `today_plans_cache` 캐시 구현
    - `narrowQueries` 옵션 (세션 조회 최적화)
    - 병렬 쿼리 패턴
  - 위험도: 🟢 낮음

- [x] **[P3-5]** `today_plans_cache` 사용 기준 정리 ✅ (2025-12-09)
  - 파일: `lib/data/todayPlans.ts`
  - 결과: 코드에 이미 구현됨
    - `useCache` 옵션 (기본: true)
    - `cacheTtlSeconds` 옵션 (기본: 120초)
    - 캠프 모드: 60초 TTL
  - 위험도: 🟡 중간

#### 3.3 타이머 상태 전이 문서화 및 강화

- [x] **[P3-6]** 타이머 상태 전이 다이어그램 작성 ✅ (2025-12-09)

  - 파일: `docs/refactoring/timer_state_machine.md`
  - 내용:
    ```
    IDLE → RUNNING (startPlan)
    RUNNING → PAUSED (pausePlan)
    PAUSED → RUNNING (resumePlan)
    RUNNING/PAUSED → COMPLETED (completePlan)
    ```
  - 추가 문서: 상태 정의, 경합 방지 규칙
  - 위험도: 🟢 낮음 (문서만)

- [x] **[P3-7]** 타이머 경합 방지 강화 ✅ (2025-12-09)
  - 파일: `app/(student)/today/actions/todayActions.ts`
  - 변경:
    - 완료된 플랜 재시작 방지 로직 추가
    - 경합 방지 규칙 주석 추가 (timer_state_machine.md 참조)
  - 위험도: 🟡 중간

#### 3.4 캠프 모드 정리

- [x] **[P3-8]** 캠프 모드 더미 콘텐츠 처리 일관화 ✅ (2025-12-09)

  - 확인: 캠프 모드에서 더미 콘텐츠 하드코딩 없음
  - 결과: 일반 today 컴포넌트 재사용, 별도 처리 불필요
  - 위험도: 🟡 중간

- [x] **[P3-9]** 캠프 today 화면 리팩토링 ✅ (2025-12-09)
  - 파일: `app/(student)/camp/today/page.tsx`
  - 결과: 일반 today 컴포넌트 재사용 (TodayPageContextProvider 등)
  - 최적화: `getTodayPlans(camp: true)` 호출로 캠프 플랜만 필터링
  - 위험도: 🟡 중간

### Phase 3 영향 범위

| 카테고리       | 파일/테이블                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| TypeScript     | `lib/scheduler/calculateAvailableDates.ts`, `lib/plan/assignPlanTimes.ts`          |
| Server Actions | `app/(student)/today/actions/todayActions.ts`                                      |
| UI 컴포넌트    | `app/(student)/today/`, `app/(student)/camp/today/`                                |
| 문서           | `docs/refactoring/timeline_strategy.md`, `docs/refactoring/timer_state_machine.md` |

### Phase 3 테스트 시나리오

1. 타임라인

   - [ ] 블록 모드와 시간 모드 각각 정상 동작 확인
   - [ ] start_time/end_time NULL인 경우 UI 방어 확인

2. 타이머

   - [ ] 동시에 두 개의 플랜 시작 시 에러 확인
   - [ ] 상태 전이 순서 준수 확인

3. 캠프 모드
   - [ ] 더미 콘텐츠 플랜 정상 표시 확인
   - [ ] 캠프 today 화면 성능 테스트

---

## 📊 Phase 요약

| Phase   | 목표           | 예상 기간 | 위험도  | 주요 산출물                      |
| ------- | -------------- | --------- | ------- | -------------------------------- |
| Phase 1 | 안전망 구축    | 1-2일     | 🟡 중간 | RLS, 트리거, 상수, 헬퍼          |
| Phase 2 | 플랜 구조 개선 | 3-5일     | 🔴 높음 | plan_group_items, 논리 플랜 CRUD |
| Phase 3 | 최적화         | 2-3일     | 🟡 중간 | 타임라인 정리, 성능 개선         |

---

## 🚀 시작 준비 체크리스트

Phase 1 시작 전:

- [ ] 현재 테스트 스위트 실행 및 통과 확인
- [ ] 로컬 개발 환경 Supabase 설정 확인
- [ ] 기존 통계 값 백업 (비교용)
- [ ] 코드 리뷰어 지정

---

## 📝 변경 기록

| 날짜       | 버전 | 내용                        |
| ---------- | ---- | --------------------------- |
| 2025-12-09 | v1.0 | 초안 작성                   |
| 2025-12-09 | v1.1 | Phase 1 완료 (P1-1 ~ P1-11) |
| 2025-12-09 | v1.2 | Phase 2 P2-1~P2-5 완료      |
| 2025-12-09 | v1.3 | Phase 2 P2-8~P2-9 완료      |
| 2025-12-09 | v1.4 | Phase 3 문서화 완료         |
| 2025-12-09 | v1.5 | 최종 플로우 문서화 완료     |
| 2025-12-09 | v1.6 | DEFERRED P3-1,2,7 완료      |
| 2025-12-09 | v1.7 | DEFERRED P2-6 완료          |
| 2025-12-09 | v1.8 | DEFERRED P2-7 (UI) 완료     |
