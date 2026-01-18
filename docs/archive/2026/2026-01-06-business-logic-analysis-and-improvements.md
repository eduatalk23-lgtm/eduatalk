# 플래너, 플랜그룹, 플랜, 단발성/일회성 플랜 비즈니스 로직 분석 및 개선 방향

**작성일**: 2026-01-06  
**목적**: 플래너 시스템, 스케줄러, 배치 기능, 캘린더 아키텍처의 비즈니스 로직 분석 및 개선 방향 도출

---

## 📋 목차

1. [엔티티 계층 구조](#1-엔티티-계층-구조)
2. [플래너(Planner) 시스템](#2-플래너planner-시스템)
3. [플랜그룹(PlanGroup) 시스템](#3-플랜그룹plangroup-시스템)
4. [플랜(Plan) 시스템](#4-플랜plan-시스템)
5. [단발성/일회성 플랜(AdHoc Plan)](#5-단발성일회성-플랜adhoc-plan)
6. [스케줄러 시스템](#6-스케줄러-시스템)
7. [배치 처리 시스템](#7-배치-처리-시스템)
8. [캘린더 및 타임라인 아키텍처](#8-캘린더-및-타임라인-아키텍처)
9. [개선 방향](#9-개선-방향)

---

## 1. 엔티티 계층 구조

### 1.1 전체 계층 구조

```
Planner (플래너)
  └─ PlanGroup (플랜 그룹)
      ├─ Plan (정규 플랜)
      └─ AdHocPlan (단발성 플랜)
```

### 1.2 엔티티별 역할

| 엔티티        | 역할                        | 특징                                           |
| ------------- | --------------------------- | ---------------------------------------------- |
| **Planner**   | 학생별 학습 기간 단위 관리  | 기간별 시간 설정, 블록셋, 스케줄러 기본값 관리 |
| **PlanGroup** | 학습 계획 그룹 (메타데이터) | 목적, 기간, 스케줄러 타입, 콘텐츠 그룹핑       |
| **Plan**      | 개별 학습 일정 (실행 단위)  | 날짜, 시간, 콘텐츠 범위, 진행률                |
| **AdHocPlan** | 단발성/일회성 학습 일정     | 반복 규칙 지원, 플랜그룹 연결                  |

---

## 2. 플래너(Planner) 시스템

### 2.1 현재 구조

**테이블**: `planners`

**주요 필드**:

- `period_start`, `period_end`: 학습 기간
- `study_hours`, `self_study_hours`, `lunch_time`: 시간 설정 (JSONB)
- `non_study_time_blocks`: 비학습 시간 블록 (JSONB 배열)
- `default_scheduler_type`, `default_scheduler_options`: 스케줄러 기본값
- `block_set_id`: 블록셋 연결

**비즈니스 로직**:

- 플래너 → 플랜그룹 상속: 시간 설정 자동 상속 (완료)
- 플래너 해제 시 상속된 설정 정리 (미완료)

### 2.2 현재 상태

✅ **완료된 작업**:

- 플래너 시간 설정 → 플랜그룹 자동 상속
- DB 마이그레이션: `plan_groups`에 `study_hours`, `self_study_hours`, `lunch_time` 컬럼 추가
- 위저드 Step1BasicInfo에서 플래너 선택 시 자동 채우기

⚠️ **미완료 작업**:

- 스케줄러 로직에서 저장된 시간 설정 활용 (하드코딩된 기본값 사용 중)
- 플래너 해제 시 상속된 설정 정리 로직
- Step3SchedulePreview에서 실제 가용 시간 시각화

### 2.3 개선 필요 사항

1. **스케줄러 통합** (우선순위: 높음)
   - 현재: `DEFAULT_STUDY_HOURS = { start: "10:00", end: "19:00" }` 하드코딩
   - 개선: `plan_group.study_hours` 사용
   - 파일: `lib/scheduler/calculateAvailableDates.ts`, `lib/scheduler/generateTimeSlots.ts`

2. **플래너 해제 시 정리 로직** (우선순위: 중간)
   - 플래너 연결 해제 시 상속된 설정 초기화
   - 수동 추가 항목은 유지, `is_locked` 항목만 제거

3. **플래너 UI 개선** (우선순위: 중간)
   - 시간 설정 폼 UI 개선
   - 비학습 블록 관리 UI
   - 플래너 복제 기능

---

## 3. 플랜그룹(PlanGroup) 시스템

### 3.1 현재 구조

**테이블**: `plan_groups`

**주요 필드**:

- `plan_purpose`: 목적 (내신대비, 모의고사, 수능, 기타)
- `scheduler_type`: 스케줄러 타입 (`1730_timetable`, `default`)
- `scheduler_options`: 스케줄러 옵션 (JSONB)
- `plan_mode`: 생성 모드 (`structured`, `content_based`, `quick`, `adhoc_migrated`)
- `is_single_day`: 단일 날짜 플랜 여부
- `planner_id`: 플래너 연결
- `study_hours`, `self_study_hours`, `lunch_time`: 시간 설정 (플래너 상속)

**플랜 타입**:

- `individual`: 개별 플랜
- `integrated`: 통합 플랜
- `camp`: 캠프 프로그램

**생성 모드**:

- `structured`: 위저드 기반 구조화된 생성
- `content_based`: 콘텐츠 기반 생성
- `quick`: 빠른 생성
- `adhoc_migrated`: 단발성 플랜에서 마이그레이션

### 3.2 비즈니스 로직

**플랜 생성 흐름**:

1. 플랜그룹 생성 (위저드 또는 API)
2. 콘텐츠 선택 및 범위 설정
3. 스케줄러 실행 (`generatePlansFromGroup`)
4. 시간 슬롯 배정 (`assignPlanTimes`)
5. DB 저장 (`student_plan` 테이블)

**상태 관리**:

- `draft`: 초안
- `active`: 활성
- `completed`: 완료
- `cancelled`: 취소

### 3.3 개선 필요 사항

1. **플랜 모드 통합 관리** (우선순위: 중간)
   - `creation_mode` (deprecated) → `plan_mode` 통합
   - 마이그레이션 스크립트 작성

2. **단일 날짜 플랜 최적화** (우선순위: 낮음)
   - `is_single_day=true`인 경우 스케줄러 로직 간소화
   - 불필요한 주기 계산 생략

---

## 4. 플랜(Plan) 시스템

### 4.1 현재 구조

**테이블**: `student_plan`

**주요 필드**:

- `plan_group_id`: 플랜그룹 참조
- `plan_date`: 학습 날짜
- `block_index`: 블록 인덱스
- `content_type`, `content_id`: 콘텐츠 정보
- `planned_start_page_or_time`, `planned_end_page_or_time`: 학습 범위
- `start_time`, `end_time`: 시간 슬롯
- `progress`, `completed_amount`: 진행률

**1730 타임테이블 확장 필드**:

- `cycle_day_number`: 주기 내 일자 번호
- `date_type`: 날짜 유형 (`study`, `review`, `exclusion`)
- `time_slot_type`: 시간대 유형 (`study`, `self_study`)
- `duration_info`, `review_info`, `allocation_type`: 메타데이터 (JSONB)

**Calendar-First 아키텍처 필드**:

- `container_type`: 컨테이너 타입 (`daily`, `weekly`, `unfinished`)
- `is_locked`: 잠금 상태
- `estimated_minutes`: 예상 학습 시간
- `order_index`: UI 정렬 순서
- `flexible_content_id`: 자유 학습 콘텐츠
- `carryover_from_date`, `carryover_count`: 이월 정보

### 4.2 비즈니스 로직

**플랜 생성**:

- 스케줄러가 `ScheduledPlan[]` 생성
- 시간 슬롯 배정 후 DB 저장
- Episode 분할 로직 적용

**플랜 수정**:

- 드래그 앤 드롭으로 날짜 이동
- 시간 조정 (`resizePlanDuration`)
- 이월 처리 (`carryover`)

**플랜 삭제**:

- 개별 삭제
- 플랜그룹 삭제 시 연쇄 삭제

### 4.3 개선 필요 사항

1. **플랜 상태 관리 통합** (우선순위: 높음)
   - `status` 필드와 `completed_at` 필드 일관성 확보
   - 진행률 계산 로직 표준화

2. **이월 로직 개선** (우선순위: 중간)
   - 이월 횟수 제한
   - 이월 플랜 자동 정리

3. **플랜 버전 관리** (우선순위: 낮음)
   - `version`, `version_group_id` 활용
   - 플랜 변경 이력 추적

---

## 5. 단발성/일회성 플랜(AdHoc Plan)

### 5.1 현재 구조

**테이블**: `ad_hoc_plans`

**주요 필드**:

- `plan_group_id`: 플랜그룹 연결 (캘린더 아키텍처 필수)
- `plan_date`: 학습 날짜
- `title`, `description`: 제목 및 설명
- `content_type`, `flexible_content_id`: 콘텐츠 정보
- `estimated_minutes`, `actual_minutes`: 예상/실제 시간
- `status`: 상태 (`pending`, `in_progress`, `paused`, `completed`, `cancelled`)
- `container_type`: 컨테이너 타입
- `recurrence_rule`: 반복 규칙 (JSONB)
- `recurrence_parent_id`: 반복 부모 ID (자기 참조)

**비즈니스 로직**:

- 단발성 플랜 생성 (`createAdHocPlan`)
- 반복 규칙 지원 (`recurrence_rule`)
- 플랜그룹으로 승격 (`promoteToRegularPlan`)
- 이월 처리 (`carryoverAdHocPlans`)

### 5.2 현재 상태

✅ **완료된 작업**:

- 단발성 플랜 CRUD
- 반복 규칙 지원
- 플랜그룹 연결
- 이월 처리

⚠️ **개선 필요 사항**:

- 반복 규칙 UI/UX 개선
- 단발성 플랜 → 정규 플랜 전환 프로세스 개선
- 단발성 플랜과 정규 플랜 통합 표시

### 5.3 개선 필요 사항

1. **반복 규칙 개선** (우선순위: 중간)
   - RRULE 형식 표준화
   - 반복 규칙 편집 UI 개선
   - 반복 플랜 일괄 수정 기능

2. **플랜 통합 표시** (우선순위: 중간)
   - 캘린더에서 단발성 플랜과 정규 플랜 통합 표시
   - 타임라인에서 통합 표시

3. **단발성 플랜 승격 프로세스** (우선순위: 낮음)
   - 단발성 플랜 → 정규 플랜 전환 시 데이터 마이그레이션 개선
   - `migrated_from_adhoc_id` 추적

---

## 6. 스케줄러 시스템

### 6.1 현재 구조

**주요 파일**:

- `lib/scheduler/SchedulerEngine.ts`: 1730 타임테이블 스케줄링 엔진
- `lib/plan/scheduler.ts`: 스케줄러 오케스트레이션
- `lib/plan/1730TimetableLogic.ts`: 1730 알고리즘 로직

**스케줄러 타입**:

- `1730_timetable`: 1730 타임테이블 알고리즘
- `default`: 기본 스케줄러 (단순 분할)

### 6.2 1730 타임테이블 알고리즘

**주요 단계**:

1. **주기 계산** (`calculateCycle`): 학습일/복습일 분류
2. **콘텐츠 필터링** (`filterContents`): 취약과목 집중 모드
3. **날짜 배정** (`calculateContentAllocation`): 전략/취약 과목 로직
4. **범위 분할** (`divideContentRanges`): 학습 범위 분할
5. **시간 슬롯 배정** (`assignTimeSlots`): Bin Packing 알고리즘 유사

**SchedulerEngine 클래스**:

- 컨텍스트 기반 설계
- 캐싱 메커니즘 (cycleDays, contentAllocationMap 등)
- 실패 원인 수집 (`failureReasons`)

### 6.3 현재 상태

✅ **완료된 작업**:

- 1730 타임테이블 알고리즘 구현
- SchedulerEngine 클래스 캡슐화
- 실패 원인 수집 및 보고

⚠️ **개선 필요 사항**:

- 플래너 시간 설정 활용 (하드코딩된 기본값 사용 중)
- 스케줄러 옵션 검증 강화
- 성능 최적화 (대량 플랜 생성 시)

### 6.4 개선 필요 사항

1. **플래너 시간 설정 통합** (우선순위: 높음)

   ```typescript
   // 현재: 하드코딩
   const DEFAULT_STUDY_HOURS = { start: "10:00", end: "19:00" };

   // 개선: plan_group에서 조회
   const studyHours = planGroup.study_hours ?? DEFAULT_STUDY_HOURS;
   const lunchTime = planGroup.lunch_time ?? { start: "12:00", end: "13:00" };
   ```

   - 파일: `lib/scheduler/calculateAvailableDates.ts`, `lib/scheduler/generateTimeSlots.ts`

2. **스케줄러 옵션 검증** (우선순위: 중간)
   - `scheduler_options` 스키마 검증
   - 잘못된 옵션에 대한 에러 처리

3. **성능 최적화** (우선순위: 중간)
   - 대량 플랜 생성 시 배치 처리
   - 캐싱 전략 개선

4. **스케줄러 확장성** (우선순위: 낮음)
   - 새로운 스케줄러 타입 추가 용이성
   - 플러그인 아키텍처 고려

---

## 7. 배치 처리 시스템

### 7.1 현재 구조

**주요 파일**:

- `app/(admin)/admin/plan-creation/_hooks/useBatchProcessor.ts`: 배치 처리 훅
- `lib/domains/admin-plan/actions/batchPreviewPlans.ts`: 배치 미리보기
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`: 배치 AI 플랜 생성
- `lib/offline/queue.ts`: 오프라인 큐 처리

**배치 처리 전략**:

- `sequential`: 순차 처리
- `parallel`: 병렬 처리 (최대 동시 실행 수 제한)

**재시도 전략**:

- 최대 재시도 횟수 설정
- 지수 백오프 (exponential backoff)
- 재시도 지연 시간 설정

### 7.2 비즈니스 로직

**useBatchProcessor 훅**:

- 학생 목록을 순차/병렬로 처리
- 진행 상황 추적 (`progress`, `results`)
- 일시정지/재개/취소 기능
- 재시도 로직

**오프라인 큐**:

- 오프라인 상태에서 액션 저장
- 온라인 복귀 시 자동 처리
- 오래된 액션 정리

### 7.3 현재 상태

✅ **완료된 작업**:

- 배치 처리 훅 구현
- 순차/병렬 처리 지원
- 재시도 로직
- 오프라인 큐

⚠️ **개선 필요 사항**:

- 배치 처리 진행 상황 UI 개선
- 에러 처리 및 복구 로직 강화
- 배치 처리 성능 최적화

### 7.4 개선 필요 사항

1. **배치 처리 UI 개선** (우선순위: 중간)
   - 진행 상황 시각화
   - 실패 항목 상세 정보 표시
   - 부분 성공 처리

2. **에러 처리 강화** (우선순위: 중간)
   - 에러 분류 (일시적/영구적)
   - 자동 복구 로직
   - 에러 리포트 생성

3. **성능 최적화** (우선순위: 낮음)
   - 대량 처리 시 청크 단위 처리
   - 메모리 사용량 최적화

---

## 8. 캘린더 및 타임라인 아키텍처

### 8.1 현재 구조

**주요 파일**:

- `app/(student)/plan/calendar/_components/DayView.tsx`: 일별 뷰
- `app/(student)/plan/calendar/_utils/timelineUtils.ts`: 타임라인 유틸리티
- `app/(student)/today/_components/TimelineView.tsx`: 타임라인 뷰

**타임라인 슬롯 타입**:

- `학습시간`: 정규 플랜
- `점심시간`: 점심 시간 블록
- `학원일정`: 학원 일정
- `이동시간`: 이동 시간
- `자율학습`: 자율 학습 시간

**타임라인 빌드 로직**:

- `daily_schedule.time_slots` 기반 타임슬롯 생성
- 플랜 시간 정보로 타임라인 배치
- 제외일 처리 (휴일지정, 기타)

### 8.2 비즈니스 로직

**buildTimelineSlots 함수**:

1. 제외일 확인 및 필터링
2. 날짜별 플랜 필터링
3. 시간 정보 기준 정렬
4. 타임슬롯 생성 및 플랜 매칭
5. 학원일정 통합

**DayView 컴포넌트**:

- 일별 플랜 표시
- 드래그 앤 드롭 지원
- 타임라인 시각화

### 8.3 현재 상태

✅ **완료된 작업**:

- 타임라인 슬롯 생성 로직
- 제외일 처리
- 학원일정 통합
- 드래그 앤 드롭 지원

⚠️ **개선 필요 사항**:

- 타임라인 성능 최적화 (대량 플랜 처리)
- 타임라인 UI/UX 개선
- 가상 타임라인 (예상 시간 표시)

### 8.4 개선 필요 사항

1. **타임라인 성능 최적화** (우선순위: 높음)
   - 가상화 (Virtualization) 적용
   - 메모이제이션 강화
   - 불필요한 리렌더링 방지

2. **타임라인 UI/UX 개선** (우선순위: 중간)
   - 타임슬롯 시각화 개선
   - 플랜 상세 정보 표시
   - 시간 충돌 시각화

3. **가상 타임라인** (우선순위: 낮음)
   - 예상 시간 표시
   - 플랜 생성 전 미리보기

---

## 9. 개선 방향

### 9.1 우선순위별 개선 계획

#### 🔴 높음 (High Priority)

1. **스케줄러 로직 통합**
   - 플래너 시간 설정 활용
   - 하드코딩된 기본값 제거
   - 예상 소요: 2-3시간

2. **플랜 상태 관리 통합**
   - `status` 필드와 `completed_at` 일관성 확보
   - 진행률 계산 로직 표준화
   - 예상 소요: 3-4시간

3. **타임라인 성능 최적화**
   - 가상화 적용
   - 메모이제이션 강화
   - 예상 소요: 4-6시간

#### 🟡 중간 (Medium Priority)

1. **플래너 해제 시 정리 로직**
   - 상속된 설정 초기화
   - 수동 추가 항목 유지
   - 예상 소요: 1-2시간

2. **Step3SchedulePreview 강화**
   - 주간 타임라인 뷰 구현
   - 가용 시간 시각화
   - 예상 소요: 4-6시간

3. **배치 처리 UI 개선**
   - 진행 상황 시각화
   - 실패 항목 상세 정보
   - 예상 소요: 3-4시간

4. **반복 규칙 개선**
   - RRULE 형식 표준화
   - 반복 규칙 편집 UI 개선
   - 예상 소요: 4-5시간

#### 🟢 낮음 (Low Priority)

1. **플랜 모드 통합 관리**
   - `creation_mode` → `plan_mode` 마이그레이션
   - 예상 소요: 2-3시간

2. **단일 날짜 플랜 최적화**
   - 스케줄러 로직 간소화
   - 예상 소요: 2-3시간

3. **플랜 버전 관리**
   - 버전 추적 시스템
   - 변경 이력 관리
   - 예상 소요: 5-6시간

### 9.2 아키텍처 개선 제안

#### 1. 서비스 레이어 분리

**현재 문제**:

- 비즈니스 로직이 액션 파일에 혼재
- 재사용성 낮음

**개선 방향**:

```
lib/domains/plan/services/
├── PlannerService.ts        # 플래너 관련 비즈니스 로직
├── PlanGroupService.ts      # 플랜그룹 관련 비즈니스 로직
├── PlanService.ts           # 플랜 관련 비즈니스 로직
├── AdHocPlanService.ts      # 단발성 플랜 관련 비즈니스 로직
└── SchedulerService.ts      # 스케줄러 관련 비즈니스 로직
```

#### 2. 타입 시스템 강화

**현재 문제**:

- 타입 정의가 여러 파일에 분산
- 타입 일관성 부족

**개선 방향**:

- 도메인별 타입 파일 통합
- 타입 가드 함수 추가
- Zod 스키마와 타입 동기화

#### 3. 에러 처리 표준화

**현재 문제**:

- 에러 처리 방식이 일관되지 않음
- 에러 메시지가 사용자 친화적이지 않음

**개선 방향**:

- 표준 에러 타입 정의
- 에러 코드 체계 구축
- 에러 메시지 다국어 지원

### 9.3 성능 최적화 제안

#### 1. 데이터베이스 최적화

- 인덱스 최적화 (플랜 조회 쿼리)
- 쿼리 최적화 (N+1 문제 해결)
- 캐싱 전략 개선

#### 2. 프론트엔드 최적화

- React Query 캐싱 전략 개선
- 컴포넌트 메모이제이션
- 코드 스플리팅

#### 3. 배치 처리 최적화

- 청크 단위 처리
- 병렬 처리 최적화
- 메모리 사용량 최적화

### 9.4 테스트 전략

#### 1. 단위 테스트

- 비즈니스 로직 단위 테스트
- 유틸리티 함수 테스트
- 타입 가드 함수 테스트

#### 2. 통합 테스트

- 스케줄러 통합 테스트
- 플랜 생성 플로우 테스트
- 배치 처리 통합 테스트

#### 3. E2E 테스트

- 플랜 생성 시나리오
- 플랜 수정 시나리오
- 배치 처리 시나리오

---

## 10. 관련 파일 목록

### 플래너

- `supabase/migrations/20260106200000_create_planners_table.sql`
- `lib/domains/admin-plan/actions/planners.ts`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx`

### 플랜그룹

- `lib/types/plan/domain.ts` (PlanGroup 타입)
- `lib/domains/plan/actions/plan-groups/create.ts`
- `lib/domains/plan/actions/plan-groups/update.ts`
- `lib/data/planGroups.ts`

### 플랜

- `lib/types/plan/domain.ts` (Plan 타입)
- `lib/domains/plan/actions/plans.ts`
- `lib/data/studentPlans.ts`

### 단발성 플랜

- `lib/domains/admin-plan/actions/adHocPlan.ts`
- `lib/domains/admin-plan/types.ts` (AdHocPlan 타입)
- `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`

### 스케줄러

- `lib/scheduler/SchedulerEngine.ts`
- `lib/plan/scheduler.ts`
- `lib/plan/1730TimetableLogic.ts`
- `lib/scheduler/calculateAvailableDates.ts`
- `lib/scheduler/generateTimeSlots.ts`

### 배치 처리

- `app/(admin)/admin/plan-creation/_hooks/useBatchProcessor.ts`
- `lib/domains/admin-plan/actions/batchPreviewPlans.ts`
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`
- `lib/offline/queue.ts`

### 캘린더/타임라인

- `app/(student)/plan/calendar/_components/DayView.tsx`
- `app/(student)/plan/calendar/_utils/timelineUtils.ts`
- `app/(student)/today/_components/TimelineView.tsx`

---

## 11. 다음 단계

1. **즉시 시작 가능한 작업**:
   - 스케줄러 로직 통합 (플래너 시간 설정 활용)
   - 플래너 해제 시 정리 로직

2. **단기 계획 (1-2주)**:
   - Step3SchedulePreview 강화
   - 배치 처리 UI 개선
   - 타임라인 성능 최적화

3. **중기 계획 (1-2개월)**:
   - 서비스 레이어 분리
   - 타입 시스템 강화
   - 에러 처리 표준화

4. **장기 계획 (3개월 이상)**:
   - 아키텍처 리팩토링
   - 성능 최적화
   - 테스트 커버리지 향상

---

**마지막 업데이트**: 2026-01-06
