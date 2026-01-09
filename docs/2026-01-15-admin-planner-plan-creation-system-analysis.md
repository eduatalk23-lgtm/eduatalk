# 관리자 영역 학생 대상 플래너 생성 및 플랜 관리 시스템 구조 분석

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: ✅ 분석 완료

---

## 📋 목차

1. [개요](#개요)
2. [시스템 구조](#시스템-구조)
3. [플래너 생성 흐름](#플래너-생성-흐름)
4. [플랜 생성 흐름](#플랜-생성-흐름)
5. [데이터 흐름](#데이터-흐름)
6. [플랜 생성 시 발생 가능한 문제점](#플랜-생성-시-발생-가능한-문제점)
7. [에러 처리 및 복구 전략](#에러-처리-및-복구-전략)
8. [개선 제안](#개선-제안)

---

## 개요

### 목적

관리자 영역에서 학생 대상 플래너 생성 및 플랜 관리 시스템의 전체 구조를 분석하고, 플랜 생성 시 발생 가능한 문제점을 문서화하여 시스템 안정성과 유지보수성을 향상시킵니다.

### 분석 범위

- **플래너 생성**: 관리자가 학생을 위한 플래너를 생성하는 과정
- **플랜 생성**: 플래너를 기반으로 학습 플랜을 생성하는 과정
- **플랜 관리**: 생성된 플랜의 조회, 수정, 삭제 등 관리 기능
- **에러 처리**: 각 단계에서 발생할 수 있는 에러와 처리 방법

### 핵심 개념

1. **플래너 (Planner)**: 학생의 학습 기간, 시간 설정, 블록셋 등을 관리하는 상위 개념
2. **플랜 그룹 (Plan Group)**: 특정 목적과 기간을 가진 플랜들의 집합
3. **플랜 (Plan)**: 실제 학습 일정에 배치되는 개별 학습 항목

---

## 시스템 구조

### 전체 아키텍처

```
관리자 영역 플랜 관리 시스템
├── 플래너 관리
│   ├── PlannerManagement (플래너 목록/선택)
│   ├── PlannerCreationModal (플래너 생성/수정)
│   └── PlannerStats (플래너 통계)
│
└── 플랜 관리
    ├── AdminPlanManagement (메인 플랜 관리 UI)
    ├── AdminPlanCreationWizard7Step (7단계 플랜 생성 위저드)
    ├── AddContentWizard (콘텐츠 추가)
    ├── AddAdHocModal (일회성 플랜 추가)
    └── AdminAIPlanModal (AI 플랜 생성)
```

### 컴포넌트 계층 구조

```
app/(admin)/admin/students/[id]/plans/
├── page.tsx (서버 컴포넌트 - 진입점)
└── _components/
    ├── StudentPlansPageClient.tsx (메인 클라이언트 래퍼)
    ├── PlannerManagement.tsx (플래너 관리)
    ├── PlannerCreationModal.tsx (플래너 생성 모달)
    ├── AdminPlanManagement.tsx (플랜 관리 메인)
    └── admin-wizard/
        ├── AdminPlanCreationWizard7Step.tsx (7단계 위저드)
        ├── _context/ (위저드 컨텍스트)
        └── steps/ (각 단계 컴포넌트)
            ├── Step1BasicInfo.tsx
            ├── Step2TimeSettings.tsx
            ├── Step3SchedulePreview.tsx
            ├── Step4ContentSelection.tsx
            ├── Step5AllocationSettings.tsx
            ├── Step6FinalReview.tsx
            └── Step7GenerateResult.tsx
```

### 데이터베이스 스키마

```
planners (플래너)
├── id
├── student_id
├── tenant_id
├── name
├── period_start
├── period_end
├── study_hours
├── self_study_hours
├── lunch_time
├── block_set_id
├── non_study_time_blocks
├── default_scheduler_type
└── default_scheduler_options

plan_groups (플랜 그룹)
├── id
├── planner_id (플래너 참조)
├── student_id
├── tenant_id
├── name
├── period_start
├── period_end
├── status (draft, saved, active, in_progress, completed)
├── scheduler_type
├── scheduler_options
└── block_set_id

plans (플랜)
├── id
├── plan_group_id (플랜 그룹 참조)
├── student_id
├── plan_date
├── content_id
├── content_type
└── status
```

---

## 플래너 생성 흐름

### 1. 플래너 생성 진입점

**경로**: `/admin/students/[id]/plans`

**컴포넌트**: `PlannerManagement.tsx`

**프로세스**:

1. **플래너 목록 조회**

   ```typescript
   const result = await getStudentPlannersAction(studentId, {
     includeArchived: showArchived,
   });
   ```

2. **플래너 생성 모달 열기**
   - "새 플래너" 버튼 클릭
   - `PlannerCreationModal` 컴포넌트 표시

3. **플래너 정보 입력**
   - 기본 정보: 이름, 기간, 목적
   - 시간 설정: 학습 시간, 자율학습 시간, 점심 시간
   - 블록셋 선택
   - 비학습 시간 블록 설정
   - 학원 일정 추가
   - 제외일 추가

4. **플래너 저장**
   ```typescript
   const planner = await createPlannerAction({
     studentId,
     name,
     periodStart,
     periodEnd,
     studyHours,
     selfStudyHours,
     lunchTime,
     blockSetId,
     nonStudyTimeBlocks,
     academySchedules,
     exclusions,
   });
   ```

### 2. 플래너 생성 서버 액션

**위치**: `lib/domains/admin-plan/actions/planners.ts`

**함수**: `_createPlanner`

**주요 로직**:

```typescript
async function _createPlanner(input: CreatePlannerInput): Promise<Planner> {
  // 1. 관리자/컨설턴트 권한 확인
  const { user, tenantId } = await checkAdminOrConsultant();

  // 2. 플래너 생성
  const { data, error } = await supabase
    .from("planners")
    .insert({
      tenant_id: tenantId,
      student_id: input.studentId,
      name: input.name,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      study_hours: input.studyHours || { start: "10:00", end: "19:00" },
      self_study_hours: input.selfStudyHours || { start: "19:00", end: "22:00" },
      lunch_time: input.lunchTime || { start: "12:00", end: "13:00" },
      block_set_id: input.blockSetId || null,
      non_study_time_blocks: input.nonStudyTimeBlocks || [],
      default_scheduler_type: input.defaultSchedulerType || "1730_timetable",
      default_scheduler_options: input.defaultSchedulerOptions || {
        study_days: 6,
        review_days: 1,
      },
      status: "draft",
    })
    .select()
    .single();

  // 3. 학원 일정 저장 (제공된 경우)
  if (input.academySchedules && input.academySchedules.length > 0) {
    await _setPlannerAcademySchedulesInternal(...);
  }

  // 4. 제외일 저장 (제공된 경우)
  if (input.exclusions && input.exclusions.length > 0) {
    await _setPlannerExclusionsInternal(...);
  }

  return mapPlannerFromDB(data);
}
```

### 3. 플래너 상속 항목

플래너에서 플랜 그룹으로 상속되는 항목:

| 항목          | 플래너 필드                  | 플랜 그룹 필드               | 상속 방식         |
| ------------- | ---------------------------- | ---------------------------- | ----------------- |
| 기간          | `period_start`, `period_end` | `period_start`, `period_end` | 자동 채우기       |
| 블록셋        | `block_set_id`               | `block_set_id`               | 자동 채우기       |
| 학습 시간     | `study_hours`                | `study_hours`                | 자동 채우기       |
| 자율학습 시간 | `self_study_hours`           | `self_study_hours`           | 자동 채우기       |
| 점심 시간     | `lunch_time`                 | `lunch_time`                 | 자동 채우기       |
| 비학습 블록   | `non_study_time_blocks`      | `non_study_time_blocks`      | 자동 채우기       |
| 스케줄러 타입 | `default_scheduler_type`     | `scheduler_type`             | 자동 채우기       |
| 스케줄러 옵션 | `default_scheduler_options`  | `scheduler_options`          | 자동 채우기       |
| 제외일        | `planner_exclusions`         | `plan_exclusions`            | `is_locked: true` |
| 학원 일정     | `planner_academy_schedules`  | `academy_schedules`          | `is_locked: true` |

---

## 플랜 생성 흐름

### 1. 플랜 생성 진입점

**경로**: `/admin/students/[id]/plans`

**컴포넌트**: `AdminPlanManagement.tsx`

**플랜 생성 방법**:

1. **플랜 그룹 생성 (7단계 위저드)**
   - `AdminPlanCreationWizard7Step` 컴포넌트
   - 가장 상세한 설정 가능

2. **콘텐츠 추가**
   - `AddContentWizard` 컴포넌트
   - 기존 플랜 그룹에 콘텐츠 추가

3. **일회성 플랜 추가**
   - `AddAdHocModal` 컴포넌트
   - 단일 날짜에 플랜 추가

4. **AI 플랜 생성**
   - `AdminAIPlanModal` 컴포넌트
   - AI 기반 자동 플랜 생성

5. **빠른 플랜 추가**
   - `AdminQuickPlanModal` 컴포넌트
   - 간단한 설정으로 빠르게 추가

### 2. 7단계 플랜 생성 위저드

**컴포넌트**: `AdminPlanCreationWizard7Step.tsx`

**단계별 프로세스**:

#### Step 1: 기본 정보

- **플래너 선택** (선택적)
  - 플래너 선택 시 자동 상속 로직 실행
  - 기간, 블록셋, 시간 설정 등 자동 채우기

- **플랜 그룹 이름**
- **기간 설정**
- **목적 선택** (내신대비, 모의고사, 수능)
- **블록셋 선택**

#### Step 2: 시간 설정

- **플래너 상속 시간 설정 표시** (읽기 전용)
- **비학습 블록 표시**
- **스케줄러 타입 선택** (1730 시간표 / 맞춤 설정)
- **학원 스케줄 관리**
- **제외 일정 관리**

#### Step 3: 스케줄 미리보기

- 생성될 스케줄을 미리 확인
- 시간 배분 시각화

#### Step 4: 콘텐츠 선택

- 학생 교재 선택
- 강의 선택
- 각 콘텐츠의 범위 설정

#### Step 5: 배분 설정

- 콘텐츠 배분 방식 설정
- 전략과목/취약과목 설정
- 주간 학습/복습 사이클 설정

#### Step 6: 최종 검토

- 모든 설정 확인
- 검증 결과 표시

#### Step 7: 생성 및 결과

- 플랜 그룹 생성
- 플랜 생성 (선택적)
- 결과 표시

### 3. 플랜 그룹 생성 서버 액션

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

**함수**: `_createPlanGroup`

**주요 프로세스**:

```typescript
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean;
    studentId?: string | null;
  }
): Promise<{ groupId: string }> {
  // 1. 인증 및 권한 확인
  const auth = await resolveAuthContext({
    studentId: options?.studentId ?? undefined,
  });

  // 2. 관리자 모드: 플래너 선택 필수
  if (isAdminContext(auth)) {
    if (!data.planner_id) {
      throw new AppError(
        "플래너를 먼저 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // 3. 데이터 검증
  const validation = PlanValidator.validateCreation(data, options);
  if (!validation.valid) {
    throw new AppError(
      validation.errors.join(", ") || "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 4. scheduler_options 통합 빌드
  let mergedSchedulerOptions = buildSchedulerOptions({
    scheduler_options: data.scheduler_options,
    time_settings: data.time_settings,
    study_review_cycle: data.study_review_cycle,
  });

  // 5. 기존 draft 확인 및 업데이트
  const existingGroup = await findExistingDraftPlanGroup(...);
  if (existingGroup) {
    await updatePlanGroupDraftAction(existingGroup.id, data);
    return { groupId: existingGroup.id };
  }

  // 6. 플랜 기간 중복 검증
  const overlapResult = await checkPlanPeriodOverlap(
    studentId,
    data.period_start,
    data.period_end
  );
  if (overlapResult.hasOverlap) {
    throw new AppError(
      `선택한 기간이 기존 플랜과 겹칩니다: ${overlappingNames}`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 7. master_content_id 조회 (배치 조회)
  const masterContentIdMap = await fetchMasterContentIds(...);

  // 8. 원자적 플랜 그룹 생성 (RPC 호출)
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    studentId,
    planGroupData,
    processedContents,
    exclusionsData,
    schedulesData
  );

  // 9. 동시성 에러 처리 (Unique violation 23505)
  if (!atomicResult.success && atomicResult.errorCode === "23505") {
    const retryExistingGroup = await findExistingDraftPlanGroup(...);
    if (retryExistingGroup) {
      await updatePlanGroupDraftAction(retryExistingGroup.id, data);
      return { groupId: retryExistingGroup.id };
    }
  }

  return { groupId: atomicResult.groupId };
}
```

### 4. 플랜 생성 (플랜 그룹에서 개별 플랜 생성)

**위치**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

**함수**: `_generatePlansWithServices`

**주요 프로세스**:

```typescript
async function _generatePlansWithServices(
  groupId: string
): Promise<{ count: number; warnings?: string[] }> {
  // 1. 동시성 제어: 플랜 그룹 락 획득
  const lockAcquired = await acquirePlanGroupLock(supabase, groupId);
  if (!lockAcquired) {
    throw new AppError(
      "플랜 생성이 이미 진행 중입니다. 잠시 후 다시 시도해주세요.",
      ErrorCode.DATABASE_ERROR,
      409,
      true
    );
  }

  // 2. 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(...);

  // 3. 상태 검증
  if (group.status !== "saved" && group.status !== "active") {
    throw new AppError(...);
  }

  // 4. 스케줄러 서비스 선택 및 플랜 생성
  const schedulerService = selectSchedulerService(group.scheduler_type);
  const plans = await schedulerService.generatePlans(...);

  // 5. 플랜 저장 (Admin 클라이언트 사용 - RLS 우회)
  const planInsertClient = isOtherStudent
    ? createSupabaseAdminClient()
    : supabase;

  await planInsertClient.from("plans").insert(plans);

  // 6. 플랜 그룹 상태 업데이트
  await updatePlanGroupStatus(groupId, "active");

  return { count: plans.length };
}
```

---

## 데이터 흐름

### 플래너 생성 → 플랜 그룹 생성 → 플랜 생성

```
1. 플래너 생성
   └── planners 테이블에 저장
   └── planner_academy_schedules 테이블에 저장
   └── planner_exclusions 테이블에 저장

2. 플랜 그룹 생성 (플래너 선택 시)
   └── 플래너 설정 자동 상속
   └── plan_groups 테이블에 저장
   └── plan_contents 테이블에 저장
   └── plan_exclusions 테이블에 저장 (플래너 제외일 상속)
   └── academy_schedules 테이블에 저장 (플래너 학원일정 상속)

3. 플랜 생성 (플랜 그룹에서)
   └── 스케줄러 서비스로 플랜 생성
   └── plans 테이블에 저장
   └── plan_groups.status 업데이트 (saved → active)
```

### 플래너 상속 데이터 흐름

```
플래너 선택 (Step 1)
  ↓
플래너 데이터 로드 (getPlannerAction)
  ↓
wizardData 자동 채우기
  ├── periodStart, periodEnd
  ├── blockSetId
  ├── studyHours, selfStudyHours, lunchTime
  ├── nonStudyTimeBlocks
  ├── schedulerType, schedulerOptions
  ├── exclusions (is_locked: true)
  └── academySchedules (is_locked: true)
  ↓
Step 2에서 읽기 전용 표시
  ↓
handleSubmit에서 planGroupData 구성
  ├── study_hours: studyHours
  ├── self_study_hours: selfStudyHours
  ├── lunch_time: lunchTime
  ├── non_study_time_blocks: nonStudyTimeBlocks
  └── ... 기타 필드
  ↓
createPlanGroupAction 호출
  ↓
서버에서 plan_groups 테이블에 저장
```

---

## 플랜 생성 시 발생 가능한 문제점

### 1. Validation 에러

#### 1.1 기간 검증 실패

**발생 위치**: `PlanValidator.validatePeriod`

**발생 조건**:

- 시작일이 종료일보다 이후인 경우
- 기간이 1일 미만인 경우
- 기간이 365일을 초과하는 경우 (경고)

**에러 메시지**:

```
"시작일은 종료일보다 이전이어야 합니다."
"플랜 기간은 최소 1일 이상이어야 합니다."
"플랜 기간이 1년을 초과합니다. 장기 플랜은 여러 개로 나누는 것을 권장합니다."
```

**해결 방법**:

- 클라이언트에서 날짜 선택 시 실시간 검증
- 서버에서 최종 검증 후 에러 반환

#### 1.2 제외일 검증 실패

**발생 위치**: `PlanValidator.validateExclusions`

**발생 조건**:

- 제외일이 플랜 기간 밖에 있는 경우
- 제외일 비율이 50%를 초과하는 경우 (경고)

**에러 메시지**:

```
"제외일 중 N개가 플랜 기간 밖에 있습니다."
"제외일이 너무 많습니다. 학습 가능한 날짜를 확인해주세요."
```

**해결 방법**:

- 제외일 추가 시 기간 내 날짜만 선택 가능하도록 제한
- 제외일 비율 경고 표시

#### 1.3 콘텐츠 검증 실패

**발생 위치**: `PlanValidator.validateContents`

**발생 조건**:

- 콘텐츠가 선택되지 않은 경우
- 콘텐츠 범위가 유효하지 않은 경우 (시작 > 종료)

**에러 메시지**:

```
"최소 1개 이상의 콘텐츠를 선택해주세요."
"콘텐츠 범위가 유효하지 않습니다."
```

**해결 방법**:

- Step 4에서 콘텐츠 선택 필수
- 범위 입력 시 실시간 검증

#### 1.4 학원 일정 검증 실패

**발생 위치**: `PlanValidator.validateAcademySchedules`

**발생 조건**:

- 시작 시간이 종료 시간보다 이후인 경우
- 시간 범위가 유효하지 않은 경우

**에러 메시지**:

```
"학원 일정의 시작 시간은 종료 시간보다 이전이어야 합니다."
```

**해결 방법**:

- 시간 선택 시 실시간 검증
- 시간 범위 자동 조정

#### 1.5 목적과 스케줄러 조합 검증 실패

**발생 위치**: `PlanValidator.validatePurposeAndScheduler`

**발생 조건**:

- 특정 목적에 맞지 않는 스케줄러 타입 선택

**에러 메시지**:

```
"선택한 목적에 맞는 스케줄러 타입을 선택해주세요."
```

### 2. 데이터베이스 에러

#### 2.1 Unique Violation (23505)

**발생 위치**: `createPlanGroupAtomic` RPC 호출

**발생 조건**:

- 동시에 같은 이름의 플랜 그룹을 생성하려는 경우
- 동시에 같은 플래너로 플랜 그룹을 생성하려는 경우

**에러 코드**: `23505`

**해결 방법**:

```typescript
if (atomicResult.errorCode === "23505") {
  // 기존 draft를 찾아서 업데이트
  const retryExistingGroup = await findExistingDraftPlanGroup(...);
  if (retryExistingGroup) {
    await updatePlanGroupDraftAction(retryExistingGroup.id, data);
    return { groupId: retryExistingGroup.id };
  }
}
```

#### 2.2 Foreign Key Constraint Violation

**발생 위치**: 플랜 그룹 생성 시

**발생 조건**:

- 존재하지 않는 `planner_id` 참조
- 존재하지 않는 `block_set_id` 참조
- 존재하지 않는 `student_id` 참조

**에러 메시지**:

```
"플래너를 찾을 수 없습니다."
"블록셋을 찾을 수 없습니다."
"학생을 찾을 수 없습니다."
```

**해결 방법**:

- 생성 전 참조 무결성 검증
- 존재하지 않는 ID에 대한 에러 처리

#### 2.3 RLS (Row Level Security) 정책 위반

**발생 위치**: 플랜 생성 시 (`_generatePlansWithServices`)

**발생 조건**:

- 관리자가 다른 학생의 플랜을 생성할 때 일반 서버 클라이언트 사용
- 데이터베이스 트리거/함수에서 교재 존재 여부 확인 시 RLS 정책에 막힘

**에러 메시지**:

```
"Referenced book (xxx) does not exist"
```

**해결 방법**:

```typescript
// Admin/Consultant가 다른 학생의 플랜을 생성할 때는 Admin 클라이언트 사용
const planInsertClient = isOtherStudent
  ? createSupabaseAdminClient()
  : supabase;
```

### 3. 권한 에러

#### 3.1 플래너 선택 필수 (관리자 모드)

**발생 위치**: `_createPlanGroup`

**발생 조건**:

- 관리자 모드에서 `planner_id`가 없는 경우

**에러 메시지**:

```
"플래너를 먼저 선택해주세요."
```

**에러 코드**: `ErrorCode.VALIDATION_ERROR` (400)

**해결 방법**:

- Step 1에서 플래너 선택 필수
- 플래너 미선택 시 다음 단계 진행 불가

#### 3.2 인증 실패

**발생 위치**: `resolveAuthContext`

**발생 조건**:

- 로그인하지 않은 사용자
- 세션이 만료된 경우

**에러 메시지**:

```
"로그인이 필요합니다."
```

**에러 코드**: `ErrorCode.UNAUTHORIZED` (401)

**해결 방법**:

- 인증 미들웨어에서 자동 처리
- 클라이언트에서 로그인 페이지로 리다이렉트

#### 3.3 권한 부족

**발생 위치**: 플랜 그룹 조회/수정 시

**발생 조건**:

- 다른 학생의 플랜 그룹에 접근하려는 경우
- 권한이 없는 작업을 수행하려는 경우

**에러 메시지**:

```
"권한이 없습니다."
```

**에러 코드**: `ErrorCode.UNAUTHORIZED` (403)

### 4. 동시성 문제

#### 4.1 플랜 생성 중복 실행

**발생 위치**: `_generatePlansWithServices`

**발생 조건**:

- 같은 플랜 그룹에 대해 동시에 여러 번 플랜 생성 요청
- 플랜 생성 중 다른 요청이 들어온 경우

**에러 메시지**:

```
"플랜 생성이 이미 진행 중입니다. 잠시 후 다시 시도해주세요."
```

**에러 코드**: `ErrorCode.DATABASE_ERROR` (409)

**해결 방법**:

```typescript
// 플랜 그룹 락 획득
const lockAcquired = await acquirePlanGroupLock(supabase, groupId);
if (!lockAcquired) {
  throw new AppError(...);
}
```

#### 4.2 플랜 그룹 중복 생성

**발생 위치**: `createPlanGroupAtomic`

**발생 조건**:

- 동시에 같은 이름의 플랜 그룹을 생성하려는 경우

**해결 방법**:

- Unique violation (23505) 에러 처리
- 기존 draft 찾아서 업데이트

### 5. 플래너 상속 문제

#### 5.1 시간 설정 누락

**발생 위치**: `AdminPlanCreationWizard7Step.handleSubmit`

**발생 조건**:

- 플래너에서 상속받은 시간 설정이 `planGroupData`에 포함되지 않는 경우

**해결 방법**:

```typescript
const planGroupData: PlanGroupCreationData = {
  // ... 기타 필드 ...
  study_hours: studyHours || null,
  self_study_hours: selfStudyHours || null,
  lunch_time: lunchTime || null,
  non_study_time_blocks: nonStudyTimeBlocks || null,
};
```

#### 5.2 플래너 데이터 로드 실패

**발생 위치**: `WizardInner` (플래너 자동 로드)

**발생 조건**:

- 플래너 ID가 유효하지 않은 경우
- 플래너가 삭제된 경우
- 네트워크 에러

**에러 메시지**:

```
"플래너를 찾을 수 없습니다."
```

**해결 방법**:

- 플래너 로드 실패 시 경고 표시
- 플래너 선택 해제 후 수동 입력 가능

### 6. 기간 중복 문제

#### 6.1 플랜 기간 중복

**발생 위치**: `checkPlanPeriodOverlap`

**발생 조건**:

- 활성/진행 중인 플랜과 기간이 겹치는 경우

**에러 메시지**:

```
"선택한 기간이 기존 플랜과 겹칩니다: [플랜 이름들]"
```

**에러 코드**: `ErrorCode.VALIDATION_ERROR` (400)

**해결 방법**:

- 플랜 그룹 생성 전 기간 중복 검증
- 중복 플랜 목록 표시
- 기간 조정 안내

### 7. 콘텐츠 검증 문제

#### 7.1 콘텐츠 존재 여부 검증 실패

**발생 위치**: `PlanValidationService.validateContentExistence`

**발생 조건**:

- 선택한 콘텐츠가 삭제된 경우
- 다른 학생의 콘텐츠를 선택한 경우

**에러 메시지**:

```
"선택한 콘텐츠를 찾을 수 없습니다."
```

**해결 방법**:

- 콘텐츠 선택 시 존재 여부 확인
- 삭제된 콘텐츠 필터링

#### 7.2 콘텐츠 범위 검증 실패

**발생 위치**: `PlanValidator.validateContents`

**발생 조건**:

- 시작 범위가 종료 범위보다 큰 경우
- 범위가 콘텐츠 전체 범위를 초과하는 경우

**에러 메시지**:

```
"콘텐츠 범위가 유효하지 않습니다."
```

**해결 방법**:

- 범위 입력 시 실시간 검증
- 최대 범위 자동 제한

### 8. 스케줄러 문제

#### 8.1 스케줄러 서비스 선택 실패

**발생 위치**: `selectSchedulerService`

**발생 조건**:

- 지원하지 않는 스케줄러 타입
- 스케줄러 타입이 null인 경우

**에러 메시지**:

```
"지원하지 않는 스케줄러 타입입니다."
```

**해결 방법**:

- 기본 스케줄러 타입 설정
- 스케줄러 타입 검증

#### 8.2 플랜 생성 실패

**발생 위치**: 스케줄러 서비스의 `generatePlans`

**발생 조건**:

- 시간 배분이 불가능한 경우
- 제약 조건을 만족할 수 없는 경우

**에러 메시지**:

```
"플랜을 생성할 수 없습니다. 설정을 확인해주세요."
```

**해결 방법**:

- 제약 조건 완화 옵션 제공
- 경고 메시지와 함께 부분 생성

### 9. daily_schedule 검증 문제

**발생 위치**: `_createPlanGroup`

**발생 조건**:

- `daily_schedule`에 `time_slots`가 없는 날짜가 있는 경우
- 제외일이 아닌 날짜에 `time_slots`가 빈 배열인 경우

**에러 메시지**:

```
"daily_schedule에 time_slots가 없는 날짜가 있습니다: [날짜들]"
```

**에러 코드**: `ErrorCode.VALIDATION_ERROR` (400)

**해결 방법**:

- `daily_schedule` 생성 시 모든 날짜에 `time_slots` 포함
- 제외일인 경우 빈 배열 허용

---

## 에러 처리 및 복구 전략

### 1. 에러 처리 계층

```
클라이언트 컴포넌트
  ↓ (에러 캐치)
서버 액션 (withErrorHandlingSafe)
  ↓ (에러 변환)
내부 함수 (AppError throw)
  ↓ (에러 로깅)
데이터베이스 (PostgreSQL 에러)
```

### 2. 에러 타입별 처리

#### 2.1 Validation 에러 (400)

**처리 방법**:

- 클라이언트에서 실시간 검증
- 서버에서 최종 검증
- 사용자에게 명확한 에러 메시지 표시

**복구 전략**:

- 입력 필드 하이라이트
- 에러 메시지와 함께 수정 안내

#### 2.2 데이터베이스 에러 (500)

**처리 방법**:

- 에러 로깅
- 사용자에게 일반적인 에러 메시지 표시
- 관리자에게 상세 에러 정보 전달

**복구 전략**:

- Unique violation: 기존 draft 찾아서 업데이트
- Foreign key violation: 참조 무결성 검증 후 재시도
- RLS violation: Admin 클라이언트 사용

#### 2.3 동시성 에러 (409)

**처리 방법**:

- 플랜 그룹 락 획득
- 락 획득 실패 시 에러 반환

**복구 전략**:

- 사용자에게 재시도 안내
- 자동 재시도 (최대 3회)

#### 2.4 권한 에러 (401, 403)

**처리 방법**:

- 인증 미들웨어에서 자동 처리
- 로그인 페이지로 리다이렉트

**복구 전략**:

- 세션 갱신
- 권한 재확인

### 3. 에러 로깅

**위치**: `lib/errors/errorHandler.ts`

**로깅 내용**:

- 에러 타입
- 에러 메시지
- 스택 트레이스
- 사용자 정보
- 요청 컨텍스트

**로깅 레벨**:

- 개발 환경: 모든 에러 상세 로깅
- 프로덕션 환경: 중요한 에러만 로깅

### 4. 사용자 피드백

**에러 표시 방법**:

- Toast 알림 (일시적 에러)
- 모달 다이얼로그 (중요한 에러)
- 인라인 에러 메시지 (입력 필드)

**에러 메시지 원칙**:

- 사용자 친화적인 메시지
- 구체적인 해결 방법 제시
- 기술적인 에러 메시지 숨김

---

## 개선 제안

### 1. 플래너 선택 필수화

**현재 상태**: 플래너 선택이 선택적

**개선 방안**:

- 관리자 모드에서 플래너 선택 필수
- 플래너 미선택 시 플랜 생성 불가
- 플래너 선택 UI 개선

### 2. 에러 처리 개선

**현재 상태**: 일부 에러가 명확하지 않음

**개선 방안**:

- 에러 타입별 명확한 메시지
- 에러 복구 가이드 제공
- 자동 복구 시도

### 3. 동시성 제어 강화

**현재 상태**: 플랜 생성에만 락 적용

**개선 방안**:

- 플랜 그룹 생성에도 락 적용
- 분산 락 시스템 도입
- 락 타임아웃 설정

### 4. 검증 강화

**현재 상태**: 서버 사이드 검증만 존재

**개선 방안**:

- 클라이언트 사이드 실시간 검증
- 검증 결과 시각화
- 검증 실패 시 수정 가이드

### 5. 플래너 상속 개선

**현재 상태**: 시간 설정 누락 문제 해결됨

**개선 방안**:

- 상속 항목 시각화
- 상속 항목 수정 가능 여부 명확화
- 상속 항목 변경 시 영향 범위 표시

### 6. 모니터링 및 알림

**현재 상태**: 에러 로깅만 존재

**개선 방안**:

- 에러 발생 시 실시간 알림
- 에러 통계 대시보드
- 에러 트렌드 분석

---

## 복잡성 레벨 분석

### 1. 복잡성 지표

#### 1.1 구조적 복잡성

**컴포넌트 수**:

| 카테고리 | 개수 | 설명 |
|---------|------|------|
| 메인 컴포넌트 | 1 | `AdminPlanCreationWizard7Step` |
| Step 컴포넌트 | 7 | Step1~Step7 |
| Context 컴포넌트 | 4 | Data, Step, Validation, Batch |
| 공통 컴포넌트 | 2 | ErrorBoundary, AutoSaveIndicator |
| 모달 컴포넌트 | 2 | AcademyScheduleImport, ExclusionImport |
| 하위 컴포넌트 | 3 | DayTimelineBar, WeeklyAvailabilityTimeline, MasterContentSearchModal |
| 커스텀 훅 | 1 | useAdminAutoSave |
| **총계** | **20+** | 위저드 관련 컴포넌트만 |

**파일 수**:

- 위저드 관련 파일: 23개
- 플랜 관리 관련 파일: 50+개
- 전체 관리자 플랜 관리 시스템: 100+개 파일

**단계 수**:

- 7단계 위저드 (관리자 영역)
- 7단계 위저드 (학생 영역)
- 3단계 빠른 생성 (학생 영역)
- 3단계 콘텐츠 추가 (관리자 영역)

#### 1.2 상태 관리 복잡성

**Context 계층 구조**:

```
AdminWizardProvider (최상위)
├── AdminWizardDataContext (데이터 상태)
├── AdminWizardStepContext (단계 상태)
├── AdminWizardValidationContext (검증 상태)
└── BatchWizardContext (배치 모드)
```

**상태 관리 복잡도**:

- **Context 개수**: 4개
- **상태 필드 수**: 30+ 필드 (wizardData)
- **상태 업데이트 함수**: 10+ 함수
- **의존성 관계**: 복잡 (Context 간 상호 의존)

**상태 동기화**:

- 자동 저장 (AutoSave)
- 플래너 상속 자동 채우기
- 검증 상태 실시간 업데이트
- 배치 모드 상태 관리

#### 1.3 데이터 흐름 복잡성

**데이터 흐름 경로**:

```
플래너 선택
  ↓
플래너 데이터 로드 (getPlannerAction)
  ↓
wizardData 자동 채우기 (10개 필드)
  ↓
각 Step에서 수정 가능
  ↓
검증 (실시간 + 최종)
  ↓
자동 저장 (draft)
  ↓
최종 제출 (createPlanGroupAction)
  ↓
플랜 생성 (generatePlansWithServices)
```

**데이터 변환 단계**:

1. 플래너 데이터 → wizardData (자동 상속)
2. wizardData → PlanGroupCreationData (제출 시)
3. PlanGroupCreationData → PlanGroupAtomicInput (서버)
4. PlanGroupAtomicInput → DB 저장 (RPC)

**상속 메커니즘**:

- 10개 항목 자동 상속
- `is_locked` 플래그로 수정 제한
- 상속 항목과 수동 입력 항목 혼재

#### 1.4 에러 처리 복잡성

**에러 타입**:

- Validation 에러: 5가지
- 데이터베이스 에러: 3가지
- 권한 에러: 3가지
- 동시성 에러: 2가지
- 플래너 상속 에러: 2가지
- 기타 에러: 4가지

**총 에러 케이스**: 19가지

**에러 처리 계층**:

```
클라이언트 컴포넌트
  ↓ (에러 캐치)
서버 액션 (withErrorHandlingSafe)
  ↓ (에러 변환)
내부 함수 (AppError throw)
  ↓ (에러 로깅)
데이터베이스 (PostgreSQL 에러)
```

#### 1.5 검증 복잡성

**검증 레이어**:

1. **클라이언트 사이드 검증**
   - 실시간 검증 (각 Step)
   - 최종 검증 (제출 전)

2. **서버 사이드 검증**
   - `PlanValidator.validateCreation`
   - 6가지 검증 카테고리

**검증 항목**:

- 기간 검증
- 제외일 검증
- 콘텐츠 검증
- 학원 일정 검증
- 목적-스케줄러 조합 검증
- 비학습 시간 블록 검증

#### 1.6 동시성 제어 복잡성

**동시성 제어 메커니즘**:

- 플랜 그룹 락 (acquirePlanGroupLock)
- Unique violation 처리 (23505)
- Draft 중복 생성 방지
- 플랜 생성 중복 실행 방지

**복잡도 요인**:

- 여러 레벨의 동시성 제어
- 에러 복구 로직 포함
- 재시도 메커니즘

### 2. 복잡성 점수 (Cyclomatic Complexity)

**복잡성 평가 기준**:

| 항목 | 점수 | 가중치 | 총점 |
|------|------|--------|------|
| 컴포넌트 수 | 8/10 | 1.0 | 8.0 |
| 단계 수 | 7/10 | 1.2 | 8.4 |
| 상태 관리 | 9/10 | 1.5 | 13.5 |
| 데이터 흐름 | 8/10 | 1.3 | 10.4 |
| 에러 처리 | 7/10 | 1.0 | 7.0 |
| 검증 로직 | 6/10 | 0.8 | 4.8 |
| 동시성 제어 | 7/10 | 1.0 | 7.0 |
| **총 복잡도 점수** | | | **59.1/100** |

**복잡도 등급**: **높음 (High Complexity)**

- 50-70점: 높은 복잡도
- 70-90점: 매우 높은 복잡도
- 90점 이상: 극도로 높은 복잡도

### 3. 비교 대상군

#### 3.1 학생 영역 플랜 생성 시스템

| 항목 | 관리자 영역 | 학생 영역 | 차이 |
|------|------------|----------|------|
| 위저드 단계 | 7단계 | 7단계 | 동일 |
| 컴포넌트 수 | 20+ | 100+ | 학생 영역이 더 많음 |
| 플래너 상속 | ✅ 있음 | ❌ 없음 | 관리자만 |
| 배치 모드 | ✅ 있음 | ❌ 없음 | 관리자만 |
| Context 수 | 4개 | 3개 | 관리자가 더 많음 |
| 에러 케이스 | 19가지 | 15가지 | 관리자가 더 많음 |
| 복잡도 점수 | 59.1 | 55.0 | 관리자가 약간 높음 |

**분석**:

- 학생 영역은 컴포넌트 수가 많지만, 플래너 상속과 배치 모드가 없어 전체 복잡도는 낮음
- 관리자 영역은 플래너 상속 메커니즘으로 인해 데이터 흐름이 더 복잡함

#### 3.2 빠른 생성 시스템 (3단계)

| 항목 | 7단계 위저드 | 3단계 빠른 생성 | 차이 |
|------|------------|---------------|------|
| 단계 수 | 7단계 | 3단계 | 57% 감소 |
| 컴포넌트 수 | 20+ | 5-7 | 70% 감소 |
| 상태 필드 | 30+ | 10-15 | 50% 감소 |
| 검증 항목 | 6가지 | 3가지 | 50% 감소 |
| 복잡도 점수 | 59.1 | 25.0 | 58% 감소 |

**분석**:

- 빠른 생성은 필수 항목만 포함하여 복잡도가 크게 낮음
- 하지만 기능 제한이 있어 모든 시나리오를 커버하지 못함

#### 3.3 일반적인 CRUD 시스템

| 항목 | 관리자 플랜 생성 | 일반 CRUD | 차이 |
|------|----------------|----------|------|
| 단계 수 | 7단계 | 1단계 (폼) | 7배 |
| 컴포넌트 수 | 20+ | 3-5 | 4-6배 |
| 상태 관리 | 4개 Context | 1개 상태 | 4배 |
| 검증 로직 | 6가지 | 1-2가지 | 3-6배 |
| 에러 처리 | 19가지 | 3-5가지 | 4-6배 |
| 복잡도 점수 | 59.1 | 15.0 | 4배 |

**분석**:

- 일반 CRUD 시스템에 비해 4배 이상 복잡함
- 하지만 교육 플랫폼의 특수성(플래너, 스케줄러, 상속 등)을 고려하면 합리적

#### 3.4 다른 교육 플랫폼 (추정)

| 항목 | 현재 시스템 | 일반 교육 플랫폼 | 차이 |
|------|-----------|----------------|------|
| 단계 수 | 7단계 | 3-5단계 | 더 많음 |
| 플래너 개념 | ✅ 있음 | ❌ 없음 | 고유 기능 |
| 상속 메커니즘 | ✅ 있음 | ❌ 없음 | 고유 기능 |
| 스케줄러 | ✅ 복잡 | ⚠️ 단순 | 더 복잡 |
| 복잡도 점수 | 59.1 | 35-45 | 더 높음 |

**분석**:

- 플래너와 상속 메커니즘은 고유 기능으로 복잡도를 높임
- 하지만 이는 시스템의 핵심 가치를 제공하는 기능

### 4. 복잡성 요인 분석

#### 4.1 복잡도를 높이는 요인

**1. 플래너 상속 메커니즘** (복잡도 +15%)

- 10개 항목 자동 상속
- `is_locked` 플래그 관리
- 상속 항목과 수동 입력 혼재
- 플래너 데이터 로드 및 변환

**2. 7단계 위저드 구조** (복잡도 +20%)

- 단계 간 데이터 전달
- 단계별 검증 로직
- 단계별 UI 컴포넌트
- 단계 간 의존성 관리

**3. 다중 Context 상태 관리** (복잡도 +18%)

- 4개 Context 간 상호 의존
- 상태 동기화
- 상태 업데이트 함수 다수
- 배치 모드 상태 관리

**4. 복잡한 검증 로직** (복잡도 +12%)

- 6가지 검증 카테고리
- 클라이언트 + 서버 검증
- 실시간 검증
- 최종 검증

**5. 다양한 에러 처리** (복잡도 +10%)

- 19가지 에러 케이스
- 에러 처리 계층
- 에러 복구 로직
- 에러 로깅

**6. 동시성 제어** (복잡도 +8%)

- 플랜 그룹 락
- Unique violation 처리
- Draft 중복 방지
- 재시도 메커니즘

**7. 배치 모드** (복잡도 +7%)

- 다중 학생 처리
- 배치 상태 관리
- 배치 에러 처리

**8. 자동 저장** (복잡도 +5%)

- Draft 자동 저장
- 저장 시점 결정
- 저장 실패 처리

**9. 스케줄러 통합** (복잡도 +5%)

- 여러 스케줄러 타입
- 스케줄러 옵션 관리
- 스케줄 미리보기

#### 4.2 복잡도 기여도

| 요인 | 기여도 | 누적 복잡도 |
|------|--------|------------|
| 7단계 위저드 | 20% | 20% |
| 다중 Context | 18% | 38% |
| 플래너 상속 | 15% | 53% |
| 검증 로직 | 12% | 65% |
| 에러 처리 | 10% | 75% |
| 동시성 제어 | 8% | 83% |
| 배치 모드 | 7% | 90% |
| 자동 저장 | 5% | 95% |
| 스케줄러 통합 | 5% | 100% |

### 5. 복잡성을 낮추는 방법

#### 5.1 단계 수 감소 (복잡도 -15%)

**현재**: 7단계

**개선 방안**:

1. **Step 2와 Step 3 통합** (시간 설정 + 미리보기)
   - 복잡도 감소: -5%
   - 사용자 경험: 약간 저하 (하지만 실시간 미리보기로 보완 가능)

2. **Step 4와 Step 5 통합** (콘텐츠 선택 + 배분 설정)
   - 복잡도 감소: -5%
   - 사용자 경험: 약간 저하 (하지만 통합 UI로 보완 가능)

3. **Step 6 제거** (최종 검토 단계를 Step 5에 통합)
   - 복잡도 감소: -5%
   - 사용자 경험: 약간 저하 (하지만 각 단계에서 검토 가능)

**개선 후**: 5단계

```
Step 1: 기본 정보
Step 2: 시간 설정 및 미리보기
Step 3: 콘텐츠 선택 및 배분
Step 4: 최종 확인 및 생성
Step 5: 결과
```

**예상 복잡도 감소**: 59.1 → 50.2 (-15%)

#### 5.2 Context 통합 (복잡도 -12%)

**현재**: 4개 Context

**개선 방안**:

1. **Data + Step Context 통합**
   - 하나의 Context로 통합
   - 상태 업데이트 함수 통합

2. **Validation Context를 Data Context에 통합**
   - 검증 상태를 wizardData에 포함
   - 검증 함수를 Data Context에 포함

**개선 후**: 2개 Context

```
AdminWizardProvider
├── AdminWizardMainContext (Data + Step + Validation)
└── BatchWizardContext (배치 모드만 분리)
```

**예상 복잡도 감소**: 59.1 → 52.0 (-12%)

#### 5.3 플래너 상속 단순화 (복잡도 -10%)

**현재**: 10개 항목 자동 상속 + is_locked 관리

**개선 방안**:

1. **상속 항목 그룹화**
   - 기본 설정 그룹 (기간, 블록셋)
   - 시간 설정 그룹 (학습 시간, 자율학습 시간, 점심 시간)
   - 스케줄러 설정 그룹 (타입, 옵션)
   - 일정 그룹 (제외일, 학원 일정)

2. **상속 UI 개선**
   - 상속 항목을 한 번에 표시
   - 상속 항목 수정 가능 여부 명확화
   - 상속 항목 변경 시 영향 범위 표시

3. **상속 로직 단순화**
   - 상속 함수 통합
   - 상속 데이터 변환 단순화

**예상 복잡도 감소**: 59.1 → 53.2 (-10%)

#### 5.4 검증 로직 통합 (복잡도 -8%)

**현재**: 클라이언트 + 서버 검증 분리

**개선 방안**:

1. **검증 스키마 공유**
   - Zod 스키마를 클라이언트와 서버에서 공유
   - 검증 함수 통합

2. **검증 결과 통일**
   - 검증 결과 타입 통일
   - 검증 에러 메시지 통일

3. **검증 캐싱**
   - 검증 결과 캐싱
   - 불필요한 재검증 방지

**예상 복잡도 감소**: 59.1 → 54.4 (-8%)

#### 5.5 에러 처리 통합 (복잡도 -7%)

**현재**: 19가지 에러 케이스, 다중 에러 처리 계층

**개선 방안**:

1. **에러 타입 그룹화**
   - Validation 에러 그룹
   - 데이터베이스 에러 그룹
   - 권한 에러 그룹
   - 동시성 에러 그룹

2. **에러 처리 미들웨어**
   - 통합 에러 처리 미들웨어
   - 에러 타입별 자동 처리

3. **에러 복구 자동화**
   - 자동 복구 로직
   - 재시도 메커니즘 통합

**예상 복잡도 감소**: 59.1 → 55.0 (-7%)

#### 5.6 컴포넌트 재사용 (복잡도 -6%)

**현재**: 각 Step이 독립적인 컴포넌트

**개선 방안**:

1. **공통 컴포넌트 추출**
   - 입력 필드 컴포넌트
   - 검증 메시지 컴포넌트
   - 단계 네비게이션 컴포넌트

2. **Step 컴포넌트 통합**
   - 유사한 Step 통합
   - Step 내부 컴포넌트 재사용

3. **컴포넌트 라이브러리화**
   - 위저드 컴포넌트 라이브러리
   - 재사용 가능한 컴포넌트

**예상 복잡도 감소**: 59.1 → 55.6 (-6%)

#### 5.7 상태 관리 단순화 (복잡도 -5%)

**현재**: 30+ 상태 필드, 10+ 업데이트 함수

**개선 방안**:

1. **상태 필드 그룹화**
   - 기본 정보 그룹
   - 시간 설정 그룹
   - 콘텐츠 그룹
   - 스케줄러 그룹

2. **상태 업데이트 함수 통합**
   - 그룹별 업데이트 함수
   - 일괄 업데이트 함수

3. **상태 불변성 보장**
   - Immer 사용
   - 상태 업데이트 단순화

**예상 복잡도 감소**: 59.1 → 56.1 (-5%)

#### 5.8 자동 저장 최적화 (복잡도 -3%)

**현재**: 모든 변경사항 자동 저장

**개선 방안**:

1. **Debounce 적용**
   - 입력 완료 후 저장
   - 불필요한 저장 방지

2. **변경사항 추적**
   - 실제 변경된 필드만 저장
   - 불필요한 저장 방지

3. **저장 실패 처리 개선**
   - 저장 실패 시 사용자 알림
   - 자동 재시도

**예상 복잡도 감소**: 59.1 → 57.3 (-3%)

### 6. 종합 개선 시나리오

#### 시나리오 1: 단계 통합 중심 (권장)

**적용 개선**:

1. 단계 수 감소 (7단계 → 5단계): -15%
2. Context 통합 (4개 → 2개): -12%
3. 플래너 상속 단순화: -10%
4. 검증 로직 통합: -8%
5. 에러 처리 통합: -7%

**예상 복잡도**: 59.1 → **38.5** (-35%)

**장점**:

- 복잡도 대폭 감소
- 유지보수성 향상
- 사용자 경험 개선 (단계 수 감소)

**단점**:

- 리팩토링 작업량 많음
- 기존 사용자 적응 필요

#### 시나리오 2: 점진적 개선

**적용 개선**:

1. Context 통합 (4개 → 2개): -12%
2. 플래너 상속 단순화: -10%
3. 검증 로직 통합: -8%
4. 에러 처리 통합: -7%
5. 컴포넌트 재사용: -6%

**예상 복잡도**: 59.1 → **42.0** (-29%)

**장점**:

- 점진적 개선 가능
- 리스크 낮음
- 기존 기능 유지

**단점**:

- 복잡도 감소 효과 제한적
- 단계 수는 유지

#### 시나리오 3: 최소 개선

**적용 개선**:

1. 컴포넌트 재사용: -6%
2. 상태 관리 단순화: -5%
3. 자동 저장 최적화: -3%

**예상 복잡도**: 59.1 → **52.0** (-12%)

**장점**:

- 최소한의 변경
- 빠른 적용 가능
- 리스크 최소

**단점**:

- 복잡도 감소 효과 제한적
- 근본적 개선 없음

### 7. 복잡도 감소 우선순위

**우선순위 1 (즉시 적용 가능)**:

1. ✅ Context 통합 (4개 → 2개)
2. ✅ 플래너 상속 단순화
3. ✅ 검증 로직 통합
4. ✅ 에러 처리 통합

**예상 복잡도**: 59.1 → **42.0** (-29%)

**우선순위 2 (중기 개선)**:

1. 단계 수 감소 (7단계 → 5단계)
2. 컴포넌트 재사용
3. 상태 관리 단순화

**예상 복잡도**: 42.0 → **32.0** (-24%)

**우선순위 3 (장기 개선)**:

1. 자동 저장 최적화
2. 동시성 제어 개선
3. 스케줄러 통합 개선

**예상 복잡도**: 32.0 → **28.0** (-13%)

### 8. 복잡도 감소 로드맵

**Phase 1: 즉시 개선 (1-2개월)**

- Context 통합
- 플래너 상속 단순화
- 검증 로직 통합
- 에러 처리 통합

**목표 복잡도**: 59.1 → 42.0 (-29%)

**Phase 2: 중기 개선 (3-6개월)**

- 단계 수 감소
- 컴포넌트 재사용
- 상태 관리 단순화

**목표 복잡도**: 42.0 → 32.0 (-24%)

**Phase 3: 장기 개선 (6-12개월)**

- 자동 저장 최적화
- 동시성 제어 개선
- 스케줄러 통합 개선

**목표 복잡도**: 32.0 → 28.0 (-13%)

**최종 목표**: 59.1 → **28.0** (-53% 복잡도 감소)

---

## 참고 문서

- [관리자 플래너-플랜 관리 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)
- [관리자 플래너 위저드 상속 분석](./2026-01-15-admin-planner-wizard-inheritance-analysis.md)
- [관리자 플랜 생성 플로우 중앙화 분석](./2026-01-15-admin-plan-creation-flow-centralization-analysis.md)
- [플랜 생성 시 RLS 정책 위반 문제 해결](./plan-insert-rls-fix.md)
- [플랜 그룹 중복 생성 방지](./2025-12-04-플랜-그룹-중복-생성-방지.md)

---

**작성 완료**: 2026-01-15  
**버전**: 1.0
