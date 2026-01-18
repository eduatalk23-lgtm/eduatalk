# 플래너 시스템 종합 분석 및 기능 확장 방향

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: ✅ 분석 완료

---

## 📋 목차

1. [개요](#개요)
2. [현재 플래너 시스템 구조](#현재-플래너-시스템-구조)
3. [구현된 기능 분석](#구현된-기능-분석)
4. [부족한 기능 및 개선 사항](#부족한-기능-및-개선-사항)
5. [기능 확장 가능성](#기능-확장-가능성)
6. [아키텍처 개선 방향](#아키텍처-개선-방향)
7. [우선순위별 개선 로드맵](#우선순위별-개선-로드맵)

---

## 개요

### 목적

플래너 시스템의 현재 상태를 종합적으로 분석하고, 기능 확장 및 개선 방향을 도출합니다.

### 분석 범위

- **플래너 엔티티**: 학생별 학습 기간 단위 관리
- **플래너 설정**: 시간 설정, 블록셋, 스케줄러 옵션
- **플래너 관리**: CRUD, 상태 관리, 제외일/학원일정 관리
- **플래너 통합**: 스케줄러, 캘린더, 플랜 생성과의 연계
- **UI/UX**: 관리자/학생 영역의 플래너 인터페이스

### 핵심 개념

1. **플래너 (Planner)**: 학생별 학습 기간 단위 관리 (최상위 엔티티)
2. **플랜 그룹 (Plan Group)**: 특정 목적과 기간을 가진 플랜들의 집합
3. **플랜 (Plan)**: 실제 학습 일정에 배치되는 개별 학습 항목
4. **스케줄러**: 플랜을 시간에 배치하는 알고리즘 (1730 Timetable 등)

---

## 현재 플래너 시스템 구조

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

- `planner_exclusions`: 플래너 단위 제외일 관리
- `planner_academy_schedules`: 플래너 단위 학원일정 관리
- `plan_groups`: 플랜 그룹 (planner_id로 연결)
- `student_plan`: 개별 플랜 (plan_group_id로 연결)

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
  ├─ 제외일 관리 (planner_exclusions)
  │   ├─ exclusion_date (제외일)
  │   ├─ exclusion_type (휴가, 개인사정, 휴일지정, 기타)
  │   └─ reason (사유)
  │
  ├─ 학원일정 관리 (planner_academy_schedules)
  │   ├─ day_of_week (요일)
  │   ├─ start_time, end_time (시간)
  │   └─ travel_time (이동시간)
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

### 주요 파일 구조

```
lib/domains/admin-plan/
├── actions/
│   ├── planners.ts                    # 플래너 CRUD 액션
│   └── planCreation/
│       ├── scheduleGenerator.ts       # 플래너 기반 스케줄 생성
│       └── validatePlanner.ts         # 플래너 검증
├── utils/
│   └── plannerConfigInheritance.ts    # 플래너 설정 상속 유틸리티
└── constants/
    └── schedulerDefaults.ts           # 스케줄러 기본값 상수

app/(admin)/admin/students/[id]/plans/
├── _components/
│   ├── AdminPlanManagement.tsx        # 메인 플랜 관리 UI
│   ├── PlannerManagement.tsx          # 플래너 목록/선택
│   ├── PlannerCreationModal.tsx      # 플래너 생성/수정
│   ├── PlannerStats.tsx              # 플래너 통계
│   └── PlannerHeader.tsx             # 플래너 헤더

components/plan/
├── PlannerSelector.tsx                # 플래너 선택 컴포넌트
└── PlannerTimeline.tsx                # 플래너 타임라인 시각화

app/api/admin/planners/
└── [plannerId]/schedule/route.ts     # 플래너 스케줄 API
```

---

## 구현된 기능 분석

### ✅ 완료된 기능

#### 1. 플래너 CRUD 기능

**위치**: `lib/domains/admin-plan/actions/planners.ts`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 플래너 생성 (`createPlannerAction`)
- ✅ 플래너 조회 (`getPlannerAction`, `getStudentPlannersAction`)
- ✅ 플래너 수정 (`updatePlannerAction`)
- ✅ 플래너 삭제 (`deletePlannerAction` - 소프트 삭제)
- ✅ 플래너 상태 변경 (`updatePlannerStatusAction`)

**특징**:

- 제외일, 학원일정을 플래너 생성 시 함께 저장 가능
- 기존 플랜 그룹에 변경사항 동기화 옵션 (`syncToExistingGroups`)
- 권한 체크 (관리자/컨설턴트만 접근)

#### 2. 제외일 관리

**위치**: `lib/domains/admin-plan/actions/planners.ts`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 제외일 추가 (`addPlannerExclusionAction`)
- ✅ 제외일 삭제 (`removePlannerExclusionAction`)
- ✅ 제외일 일괄 설정 (`setPlannerExclusionsAction`)
- ✅ 제외일 잠금 기능 (`is_locked`)

**제외일 타입**:

- `휴가`: 휴가로 인한 제외일
- `개인사정`: 개인 사정으로 인한 제외일
- `휴일지정`: 지정 휴일
- `기타`: 기타 사유

#### 3. 학원일정 관리

**위치**: `lib/domains/admin-plan/actions/planners.ts`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 학원일정 추가 (`addPlannerAcademyScheduleAction`)
- ✅ 학원일정 삭제 (`removePlannerAcademyScheduleAction`)
- ✅ 학원일정 일괄 설정 (`setPlannerAcademySchedulesAction`)
- ✅ 학원일정 잠금 기능 (`is_locked`)

**학원일정 정보**:

- 요일별 시간대 설정
- 이동시간 설정
- 과목 정보 (선택사항)

#### 4. 플래너 설정 상속

**위치**: `lib/domains/admin-plan/utils/plannerConfigInheritance.ts`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 플래너 설정을 플랜 그룹 생성용 설정으로 변환
- ✅ 기본값 처리 (`SCHEDULER_DEFAULTS`)
- ✅ Raw DB 형식 및 Camel 형식 지원

**상속되는 설정**:

- `study_hours`: 학습 시간
- `self_study_hours`: 자율학습 시간
- `lunch_time`: 점심 시간
- `default_scheduler_type`: 스케줄러 타입
- `default_scheduler_options`: 스케줄러 옵션
- `block_set_id`: 블록셋 ID
- `non_study_time_blocks`: 비학습시간 블록

#### 5. 플래너 기반 스케줄 생성

**위치**: `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 플래너 설정 기반 스케줄 생성
- ✅ 학원일정, 제외일, 블록셋 고려
- ✅ 날짜별 사용 가능 시간 범위 계산
- ✅ 시간 타임라인 생성

**API 엔드포인트**:

- `GET /api/admin/planners/[plannerId]/schedule`

#### 6. 플래너 타임라인 시각화

**위치**: `components/plan/PlannerTimeline.tsx`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 주간 타임라인 시각화
- ✅ 가용 학습 시간대 표시
- ✅ 기존 플랜 점유 시간 표시
- ✅ 빈 시간대 하이라이트

#### 7. 플래너 선택 컴포넌트

**위치**: `components/plan/PlannerSelector.tsx`

**구현 상태**: ✅ 완료

**주요 기능**:

- ✅ 플래너 목록 조회
- ✅ 플래너 선택 UI
- ✅ 활성 상태 필터링
- ✅ 컴팩트 모드 지원

#### 8. 플래너 관리 UI

**위치**: `app/(admin)/admin/students/[id]/plans/_components/`

**구현 상태**: ✅ 완료

**주요 컴포넌트**:

- ✅ `PlannerManagement`: 플래너 목록/선택
- ✅ `PlannerCreationModal`: 플래너 생성/수정
- ✅ `PlannerStats`: 플래너 통계
- ✅ `PlannerHeader`: 플래너 헤더

---

## 부족한 기능 및 개선 사항

### 🔴 Critical (즉시 수정 필요)

#### 1. 플래너 검증 로직 부족

**현재 상태**: ⚠️ 부분 구현

**문제점**:

- 플래너 생성 시 기간 검증만 수행
- 중복 플래너 검증 없음 (같은 기간의 활성 플래너)
- 플래너 수정 시 기존 플랜 그룹과의 충돌 검증 없음

**개선 방안**:

```typescript
// 플래너 검증 강화
export async function validatePlanner(
  plannerId: string,
  tenantId: string,
  options?: {
    checkOverlap?: boolean; // 기간 중복 검사
    checkActivePlans?: boolean; // 활성 플랜 그룹 충돌 검사
    checkConstraints?: boolean; // 제약 조건 검사
  }
): Promise<PlannerValidationResult>;
```

**우선순위**: 🔴 High

#### 2. 플래너 삭제 시 하위 데이터 처리 미흡

**현재 상태**: ⚠️ 부분 구현

**문제점**:

- 플래너 삭제 시 연결된 플랜 그룹 처리 로직 불명확
- 플랜 그룹 삭제 여부 선택 옵션 없음
- 플래너 삭제 전 경고 메시지 부족

**개선 방안**:

```typescript
// 플래너 삭제 옵션 추가
export interface DeletePlannerOptions {
  deletePlanGroups?: boolean; // 플랜 그룹도 함께 삭제
  deletePlans?: boolean; // 플랜도 함께 삭제
  archiveOnly?: boolean; // 삭제 대신 아카이브
}
```

**우선순위**: 🔴 High

### 🟠 High (빠른 시일 내 수정 권장)

#### 3. 플래너 복사 기능 없음

**현재 상태**: ❌ 미구현

**문제점**:

- 유사한 설정의 플래너를 새로 생성할 때 수동 입력 필요
- 플래너 템플릿 기능 없음

**개선 방안**:

```typescript
// 플래너 복사 기능
export async function copyPlanner(
  sourcePlannerId: string,
  options: {
    newName: string;
    newPeriodStart: string;
    newPeriodEnd: string;
    copyExclusions?: boolean; // 제외일 복사
    copyAcademySchedules?: boolean; // 학원일정 복사
    copyPlanGroups?: boolean; // 플랜 그룹 복사 (선택)
  }
): Promise<Planner>;
```

**우선순위**: 🟠 High

#### 4. 플래너 통계 및 분석 기능 부족

**현재 상태**: ⚠️ 부분 구현

**문제점**:

- 플래너별 학습 진행률 통계 없음
- 플래너별 플랜 그룹 수, 플랜 수만 표시
- 플래너별 시간 활용률 분석 없음

**개선 방안**:

```typescript
// 플래너 통계 확장
export interface PlannerStatistics {
  // 기본 통계
  planGroupCount: number;
  planCount: number;
  completedPlanCount: number;

  // 시간 통계
  totalStudyHours: number; // 총 학습 시간
  usedStudyHours: number; // 사용된 학습 시간
  utilizationRate: number; // 시간 활용률

  // 진행률 통계
  overallProgress: number; // 전체 진행률
  subjectProgress: Map<string, number>; // 과목별 진행률

  // 일정 통계
  exclusionDays: number; // 제외일 수
  academyScheduleDays: number; // 학원일정이 있는 날 수
}
```

**우선순위**: 🟠 High

#### 5. 플래너 템플릿 기능 없음

**현재 상태**: ❌ 미구현

**문제점**:

- 자주 사용하는 플래너 설정을 템플릿으로 저장 불가
- 플래너 생성 시 매번 모든 설정 입력 필요

**개선 방안**:

```typescript
// 플래너 템플릿 테이블 추가
CREATE TABLE planner_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,  -- 플래너 설정 저장
    is_public BOOLEAN DEFAULT FALSE, -- 공개 템플릿 여부
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

// 템플릿에서 플래너 생성
export async function createPlannerFromTemplate(
  templateId: string,
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<Planner>;
```

**우선순위**: 🟠 Medium

#### 6. 플래너 버전 관리 없음

**현재 상태**: ❌ 미구현

**문제점**:

- 플래너 수정 이력 추적 불가
- 이전 설정으로 롤백 불가
- 변경 사항 감사(audit) 불가

**개선 방안**:

```typescript
// 플래너 버전 관리 테이블
CREATE TABLE planner_versions (
    id UUID PRIMARY KEY,
    planner_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    version_data JSONB NOT NULL,  -- 플래너 설정 스냅샷
    changed_by UUID,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

// 버전 관리 기능
export async function createPlannerVersion(
  plannerId: string,
  reason?: string
): Promise<PlannerVersion>;

export async function restorePlannerVersion(
  plannerId: string,
  versionId: string
): Promise<Planner>;
```

**우선순위**: 🟠 Medium

### 🟡 Medium (중기 개선 권장)

#### 7. 플래너 일괄 관리 기능 부족

**현재 상태**: ❌ 미구현

**문제점**:

- 여러 학생의 플래너를 일괄 생성/수정 불가
- 플래너 일괄 삭제/아카이브 기능 없음

**개선 방안**:

```typescript
// 플래너 일괄 관리
export async function bulkCreatePlanners(
  inputs: CreatePlannerInput[]
): Promise<Planner[]>;

export async function bulkUpdatePlanners(
  plannerIds: string[],
  updates: Partial<UpdatePlannerInput>
): Promise<Planner[]>;

export async function bulkArchivePlanners(plannerIds: string[]): Promise<void>;
```

**우선순위**: 🟡 Medium

#### 8. 플래너 가져오기/내보내기 기능 없음

**현재 상태**: ❌ 미구현

**문제점**:

- 플래너 설정을 파일로 내보내기 불가
- 외부에서 플래너 설정 가져오기 불가
- 플래너 설정 공유 불가

**개선 방안**:

```typescript
// 플래너 내보내기
export async function exportPlanner(
  plannerId: string,
  format: "json" | "csv" | "excel"
): Promise<Blob>;

// 플래너 가져오기
export async function importPlanner(
  file: File,
  studentId: string
): Promise<Planner>;
```

**우선순위**: 🟡 Low

#### 9. 플래너 알림 기능 부족

**현재 상태**: ❌ 미구현

**문제점**:

- 플래너 기간 종료 알림 없음
- 플래너 상태 변경 알림 없음
- 플래너 관련 이벤트 알림 없음

**개선 방안**:

```typescript
// 플래너 알림 설정
export interface PlannerNotificationSettings {
  notifyOnPeriodEnd: boolean; // 기간 종료 알림
  notifyOnStatusChange: boolean; // 상태 변경 알림
  notifyOnPlanGroupAdded: boolean; // 플랜 그룹 추가 알림
  notifyDaysBeforeEnd: number; // 종료 N일 전 알림
}

// 알림 발송
export async function sendPlannerNotifications(
  plannerId: string,
  event: "period_end" | "status_change" | "plan_group_added"
): Promise<void>;
```

**우선순위**: 🟡 Low

#### 10. 플래너 검색 및 필터링 기능 부족

**현재 상태**: ⚠️ 부분 구현

**문제점**:

- 플래너 목록에서 검색 기능 없음
- 플래너 필터링 옵션 제한적 (상태, 기간만)
- 플래너 정렬 옵션 부족

**개선 방안**:

```typescript
// 플래너 검색 및 필터링
export interface PlannerFilters {
  search?: string; // 이름/설명 검색
  status?: PlannerStatus[]; // 상태 필터
  dateRange?: { start: string; end: string }; // 기간 필터
  hasPlanGroups?: boolean; // 플랜 그룹 보유 여부
  createdBy?: string; // 생성자 필터
  sortBy?: "name" | "period_start" | "created_at" | "updated_at";
  sortOrder?: "asc" | "desc";
}
```

**우선순위**: 🟡 Medium

---

## 기능 확장 가능성

### 1. 플래너 자동 생성 기능

**목적**: 학생 정보, 목표, 기간을 기반으로 플래너 자동 생성

**구현 방안**:

```typescript
// AI 기반 플래너 자동 생성
export async function generatePlannerAuto(
  studentId: string,
  options: {
    targetDate: string; // 목표 날짜
    planPurpose: PlanPurpose; // 플랜 목적
    studyHoursPerDay?: number; // 일일 학습 시간
    preferredSubjects?: string[]; // 선호 과목
  }
): Promise<Planner>;
```

**우선순위**: 🟢 Low (Phase 2)

### 2. 플래너 비교 기능

**목적**: 여러 플래너의 설정을 비교하여 최적의 설정 도출

**구현 방안**:

```typescript
// 플래너 비교
export async function comparePlanners(plannerIds: string[]): Promise<{
  commonSettings: Partial<Planner>;
  differences: Array<{
    field: string;
    values: unknown[];
  }>;
  recommendations: string[];
}>;
```

**우선순위**: 🟢 Low (Phase 2)

### 3. 플래너 성과 분석 기능

**목적**: 플래너별 학습 성과 분석 및 리포트 생성

**구현 방안**:

```typescript
// 플래너 성과 분석
export async function analyzePlannerPerformance(plannerId: string): Promise<{
  completionRate: number; // 완료율
  averageStudyTime: number; // 평균 학습 시간
  subjectDistribution: Map<string, number>; // 과목별 분포
  timeUtilization: number; // 시간 활용률
  recommendations: string[]; // 개선 권장사항
}>;
```

**우선순위**: 🟢 Low (Phase 2)

### 4. 플래너 공유 기능

**목적**: 플래너 설정을 다른 관리자/학생과 공유

**구현 방안**:

```typescript
// 플래너 공유
export async function sharePlanner(
  plannerId: string,
  options: {
    shareWithUsers: string[]; // 공유할 사용자 ID 목록
    shareWithTenants?: string[]; // 공유할 테넌트 ID 목록
    permission: "view" | "edit"; // 권한 레벨
  }
): Promise<void>;
```

**우선순위**: 🟢 Low (Phase 3)

### 5. 플래너 자동 조정 기능

**목적**: 학습 진행 상황에 따라 플래너 설정 자동 조정

**구현 방안**:

```typescript
// 플래너 자동 조정
export async function autoAdjustPlanner(
  plannerId: string,
  options: {
    adjustStudyHours?: boolean; // 학습 시간 조정
    adjustPeriod?: boolean; // 기간 조정
    adjustExclusions?: boolean; // 제외일 조정
  }
): Promise<Planner>;
```

**우선순위**: 🟢 Low (Phase 3)

---

## 아키텍처 개선 방향

### 1. 플래너 서비스 레이어 분리

**현재 문제점**:

- 플래너 관련 로직이 액션 파일에 집중
- 비즈니스 로직과 데이터 접근 로직 혼재

**개선 방안**:

```
lib/domains/admin-plan/
├── services/
│   ├── PlannerService.ts           # 플래너 비즈니스 로직
│   ├── PlannerValidationService.ts # 플래너 검증 로직
│   └── PlannerStatisticsService.ts # 플래너 통계 로직
├── repositories/
│   └── PlannerRepository.ts        # 데이터 접근 로직
└── actions/
    └── planners.ts                 # 서버 액션 (서비스 호출)
```

**우선순위**: 🟡 Medium

### 2. 플래너 이벤트 시스템 도입

**현재 문제점**:

- 플래너 변경 시 다른 시스템과의 연동이 명시적이지 않음
- 플래너 이벤트 추적 불가

**개선 방안**:

```typescript
// 플래너 이벤트 타입
export type PlannerEvent =
  | "planner.created"
  | "planner.updated"
  | "planner.deleted"
  | "planner.status_changed"
  | "planner.exclusion_added"
  | "planner.academy_schedule_added";

// 이벤트 발행
export async function emitPlannerEvent(
  event: PlannerEvent,
  plannerId: string,
  data: Record<string, unknown>
): Promise<void>;

// 이벤트 구독
export function subscribeToPlannerEvents(
  plannerId: string,
  callback: (event: PlannerEvent, data: unknown) => void
): () => void;
```

**우선순위**: 🟡 Medium

### 3. 플래너 캐싱 전략 개선

**현재 문제점**:

- 플래너 조회 시 캐싱 전략 불명확
- 플래너 변경 시 캐시 무효화 로직 부족

**개선 방안**:

```typescript
// 플래너 캐싱 전략
export const PLANNER_CACHE_KEYS = {
  planner: (id: string) => ["planner", id],
  studentPlanners: (studentId: string) => ["planners", "student", studentId],
  plannerSchedule: (id: string, start: string, end: string) => [
    "planner",
    id,
    "schedule",
    start,
    end,
  ],
};

// 캐시 무효화
export async function invalidatePlannerCache(plannerId: string): Promise<void>;
```

**우선순위**: 🟡 Medium

### 4. 플래너 타입 안전성 개선

**현재 문제점**:

- JSONB 필드 타입 안전성 부족
- 플래너 설정 검증 로직 분산

**개선 방안**:

```typescript
// Zod 스키마로 타입 안전성 확보
import { z } from "zod";

export const PlannerConfigSchema = z.object({
  studyHours: TimeRangeSchema,
  selfStudyHours: TimeRangeSchema,
  lunchTime: TimeRangeSchema,
  defaultSchedulerType: z.string(),
  defaultSchedulerOptions: SchedulerOptionsSchema,
  nonStudyTimeBlocks: z.array(NonStudyTimeBlockSchema),
});

// 타입 추론
export type PlannerConfig = z.infer<typeof PlannerConfigSchema>;
```

**우선순위**: 🟡 Medium

---

## 우선순위별 개선 로드맵

### Phase 1: Critical 개선 (1-2주)

1. ✅ 플래너 검증 로직 강화
   - 중복 플래너 검증
   - 플랜 그룹 충돌 검증
   - 제약 조건 검사

2. ✅ 플래너 삭제 시 하위 데이터 처리
   - 삭제 옵션 추가
   - 경고 메시지 개선
   - 트랜잭션 처리

### Phase 2: High 우선순위 개선 (2-4주)

3. ✅ 플래너 복사 기능
   - 플래너 복사 API
   - 복사 옵션 설정
   - UI 구현

4. ✅ 플래너 통계 및 분석 기능 확장
   - 시간 활용률 계산
   - 진행률 통계
   - 과목별 통계

5. ✅ 플래너 검색 및 필터링 개선
   - 검색 기능 추가
   - 필터링 옵션 확장
   - 정렬 옵션 추가

### Phase 3: Medium 우선순위 개선 (4-8주)

6. ✅ 플래너 템플릿 기능
   - 템플릿 테이블 생성
   - 템플릿 CRUD 기능
   - 템플릿에서 플래너 생성

7. ✅ 플래너 버전 관리
   - 버전 테이블 생성
   - 버전 생성/조회 기능
   - 버전 롤백 기능

8. ✅ 플래너 일괄 관리 기능
   - 일괄 생성/수정/삭제
   - 일괄 아카이브
   - UI 구현

9. ✅ 아키텍처 개선
   - 서비스 레이어 분리
   - 이벤트 시스템 도입
   - 캐싱 전략 개선

### Phase 4: Low 우선순위 개선 (8주+)

10. ✅ 플래너 가져오기/내보내기
11. ✅ 플래너 알림 기능
12. ✅ 플래너 자동 생성 기능
13. ✅ 플래너 비교 기능
14. ✅ 플래너 성과 분석 기능
15. ✅ 플래너 공유 기능
16. ✅ 플래너 자동 조정 기능

---

## 참고 문서

- [플래너 시스템과 캘린더 아키텍처 현황 분석](./2026-01-15-planner-calendar-architecture-analysis.md)
- [관리자 영역 학생 대상 플래너 생성 및 플랜 관리 시스템 구조 분석](./2026-01-15-admin-planner-plan-creation-system-analysis.md)
- [플래너 스케줄러 통합 구현 상태](./2026-01-15-planner-scheduler-integration-implementation-status.md)
- [비즈니스 로직 분석 및 개선 방향](./2026-01-06-business-logic-analysis-and-improvements.md)
- [플랜 생성 아키텍처 분석](./architecture/plan-generation-architecture.md)

---

**마지막 업데이트**: 2026-01-15
