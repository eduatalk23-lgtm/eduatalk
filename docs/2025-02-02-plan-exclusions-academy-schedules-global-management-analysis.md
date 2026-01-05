# 제외일/학원 일정 전역 관리 전환 상세 분석

> 작성일: 2025-02-02  
> 상태: 분석 완료  
> 목적: 플랜 그룹별 독립 관리에서 학생별 전역 관리로 전환하는 방안 분석

---

## 📋 목차

1. [현재 상태 분석](#현재-상태-분석)
2. [문제점 분석](#문제점-분석)
3. [학생/관리자 생성 시나리오 분석](#학생관리자-생성-시나리오-분석)
4. [개선 방안](#개선-방안)
5. [마이그레이션 계획](#마이그레이션-계획)
6. [구현 상세](#구현-상세)
7. [테스트 계획](#테스트-계획)

---

## 현재 상태 분석

### 1. 데이터베이스 스키마

#### `plan_exclusions` 테이블

```sql
CREATE TABLE plan_exclusions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  plan_group_id uuid NULL,  -- NULL 허용 (시간 관리 영역 지원)
  exclusion_date date NOT NULL,
  exclusion_type varchar(20) NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);
```

**현재 구조**:
- `plan_group_id`는 NULL 허용 (2025-12-17 마이그레이션)
- `plan_group_id`가 NULL이면 시간 관리 영역의 제외일
- `plan_group_id`가 있으면 플랜 그룹별 제외일

**외래 키 제약조건**:
- `ON DELETE SET NULL`: 플랜 그룹 삭제 시 `plan_group_id`가 NULL로 설정

#### `academy_schedules` 테이블

```sql
CREATE TABLE academy_schedules (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  plan_group_id uuid NULL,  -- NULL 허용 (시간 관리 영역 지원)
  academy_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  academy_name varchar(200),
  subject varchar(100),
  travel_time integer,
  source varchar(20),
  is_locked boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**현재 구조**:
- `plan_group_id`는 NULL 허용 (2025-12-18 마이그레이션)
- `plan_group_id`가 NULL이면 시간 관리 영역의 학원 일정
- `plan_group_id`가 있으면 플랜 그룹별 학원 일정

**외래 키 제약조건**:
- `ON DELETE SET NULL`: 플랜 그룹 삭제 시 `plan_group_id`가 NULL로 설정

### 2. 현재 데이터 저장 방식

#### 플랜 그룹 생성 시 (`lib/domains/plan/actions/plan-groups/create.ts`)

```typescript
// 제외일 데이터 준비
const exclusionsData: ExclusionInput[] = formatExclusionsForDb(processedExclusions);

// 학원 일정 데이터 준비
const schedulesData: ScheduleInput[] = data.academy_schedules?.map((s) => ({
  day_of_week: s.day_of_week,
  start_time: s.start_time,
  end_time: s.end_time,
  academy_name: s.academy_name || null,
  subject: s.subject || null,
  travel_time: s.travel_time ?? 0,
  source: s.source ?? "student",
  is_locked: s.is_locked ?? false,
})) ?? [];

// 원자적 플랜 그룹 생성 (RPC 호출)
const atomicResult = await createPlanGroupAtomic(
  tenantContext.tenantId,
  studentId,
  planGroupData,
  processedContents,
  exclusionsData,
  schedulesData
);
```

**RPC 함수 내부** (`create_plan_group_atomic`):
- 제외일 생성 시 `plan_group_id`를 플랜 그룹 ID로 설정
- 학원 일정 생성 시 `plan_group_id`를 플랜 그룹 ID로 설정

#### 플랜 그룹 업데이트 시 (`lib/domains/plan/actions/plan-groups/update.ts`)

```typescript
// 제외일 업데이트 (플랜 그룹별 관리)
if (data.exclusions !== undefined) {
  // 플랜 그룹의 기존 제외일 삭제
  await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);
  
  // 새로운 제외일 추가
  await createPlanExclusions(groupId, tenantId, data.exclusions);
}

// 학원 일정 업데이트 (플랜 그룹별 관리)
if (data.academy_schedules !== undefined) {
  // 기존 학원 일정 삭제 (현재 플랜 그룹만)
  await supabase
    .from("academy_schedules")
    .delete()
    .eq("plan_group_id", groupId);
  
  // 새로운 학원 일정 추가
  await createPlanAcademySchedules(groupId, tenantId, data.academy_schedules);
}
```

### 3. 현재 로직의 특징

#### 제외일 생성 함수 (`lib/data/planGroups.ts`)

```typescript
async function createExclusions(
  studentId: string,
  tenantId: string,
  exclusions: ExclusionInput[],
  planGroupId?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (planGroupId) {
    // 플랜 그룹별 관리: 기존 제외일과 중복 체크 후 생성
    // plan_group_id를 설정하여 저장
  } else {
    // 시간 관리 영역: plan_group_id = NULL로 저장
    // 중복 체크: 같은 날짜+유형의 제외일이 이미 있으면 스킵
  }
}
```

**현재 동작**:
- `planGroupId`가 있으면 플랜 그룹별로 독립 관리
- `planGroupId`가 없으면 시간 관리 영역에 저장 (전역 관리)

#### 학원 일정 생성 함수 (`lib/data/planGroups/academies.ts`)

```typescript
export async function createPlanAcademySchedules(
  groupId: string,
  tenantId: string,
  schedules: ScheduleInput[],
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // 플랜 그룹별 관리
  // 기존 학원 일정과 중복 체크 (같은 plan_group_id 내에서)
  // plan_group_id를 설정하여 저장
}

export async function createStudentAcademySchedules(
  studentId: string,
  tenantId: string,
  schedules: ScheduleInput[],
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // 시간 관리 영역 (전역 관리)
  // plan_group_id = NULL로 저장
  // 중복 체크: 같은 요일+시간+학원명의 일정이 이미 있으면 스킵
}
```

---

## 문제점 분석

### 1. 데이터 중복 문제

#### 시나리오: 학생이 여러 플랜 그룹 생성

**상황**:
1. 학생이 "2025년 1학기 학습 계획" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정), 2025-03-01 (삼일절)
   - 학원 일정: 월요일 15:00-17:00 (수학), 수요일 16:00-18:00 (영어)

2. 같은 학생이 "2025년 여름방학 특강" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정), 2025-08-15 (광복절)
   - 학원 일정: 월요일 15:00-17:00 (수학), 수요일 16:00-18:00 (영어)

**문제**:
- 같은 제외일(2025-01-01)이 두 플랜 그룹에 중복 저장됨
- 같은 학원 일정(월요일 수학, 수요일 영어)이 두 플랜 그룹에 중복 저장됨
- 데이터베이스에 불필요한 중복 데이터 증가

**영향**:
- 저장 공간 낭비
- 데이터 일관성 문제 (한 플랜 그룹에서 수정해도 다른 플랜 그룹에 반영 안 됨)
- 관리 복잡도 증가

### 2. 사용자 경험 문제

#### 시나리오: 학생이 플랜 그룹 수정

**상황**:
- 학생이 학원 일정을 변경 (월요일 수학 시간 변경: 15:00-17:00 → 14:00-16:00)
- 여러 플랜 그룹에 같은 학원 일정이 저장되어 있음

**문제**:
- 각 플랜 그룹마다 개별적으로 수정해야 함
- 한 플랜 그룹에서 수정해도 다른 플랜 그룹에는 반영되지 않음
- 사용자가 혼란스러워할 수 있음

### 3. 데이터 일관성 문제

#### 시나리오: 플랜 그룹 삭제

**상황**:
- 학생이 플랜 그룹을 삭제
- `ON DELETE SET NULL`로 인해 `plan_group_id`가 NULL로 변경됨

**문제**:
- 삭제된 플랜 그룹의 제외일/학원 일정이 시간 관리 영역으로 이동
- 다른 플랜 그룹에서 사용 중인 제외일/학원 일정도 함께 NULL로 변경됨
- 데이터 추적이 어려워짐

### 4. 조회 성능 문제

#### 시나리오: 플랜 그룹 조회 시 제외일/학원 일정 조회

**현재 로직** (`lib/domains/plan/actions/plan-groups/queries.ts`):

```typescript
// 플랜 그룹별 제외일 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("*")
  .eq("plan_group_id", groupId);

// 플랜 그룹별 학원 일정 조회
const { data: academySchedules } = await supabase
  .from("academy_schedules")
  .select("*")
  .eq("plan_group_id", groupId);
```

**문제**:
- 플랜 그룹별로 조회하므로 중복 데이터가 여러 번 조회됨
- 같은 학생의 제외일/학원 일정이 여러 플랜 그룹에 분산되어 있음

---

## 학생/관리자 생성 시나리오 분석

### 1. 학생이 직접 플랜 그룹 생성

#### 플로우 (`lib/domains/plan/actions/plan-groups/create.ts`)

```typescript
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    studentId?: string | null;
  }
): Promise<{ groupId: string }> {
  // Strategy Pattern 기반 인증 해결
  const auth = await resolveAuthContext({
    studentId: options?.studentId ?? undefined,
  });
  const studentId = auth.studentId; // 학생 모드: 현재 사용자 ID
  
  // 플랜 그룹 생성
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    studentId,  // 현재 사용자 ID
    planGroupData,
    processedContents,
    exclusionsData,  // plan_group_id 설정됨
    schedulesData    // plan_group_id 설정됨
  );
}
```

**현재 동작**:
1. 학생 인증 확인 (`requireStudentAuth()`)
2. `studentId`는 현재 사용자 ID로 설정
3. 제외일/학원 일정은 `plan_group_id`와 함께 저장

**문제점**:
- 같은 학생이 여러 플랜 그룹을 생성할 때마다 제외일/학원 일정이 중복 저장됨
- 학생이 학원 일정을 변경하면 모든 플랜 그룹을 개별적으로 수정해야 함

### 2. 관리자가 학생을 선택해서 플랜 그룹 생성

#### 플로우 (`lib/domains/plan/actions/plan-groups/create.ts`)

```typescript
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    studentId?: string | null; // 관리자 모드에서 직접 지정하는 student_id
  }
): Promise<{ groupId: string }> {
  const auth = await resolveAuthContext({
    studentId: options?.studentId ?? undefined,
  });
  const studentId = auth.studentId; // 관리자 모드: options.studentId
  
  // 관리자 모드 로깅
  if (isAdminContext(auth)) {
    logActionDebug(
      { domain: "plan", action: "createPlanGroup", userId: auth.userId },
      `Admin creating plan for student`,
      { adminId: auth.userId, studentId, adminRole: auth.adminRole }
    );
  }
  
  // 플랜 그룹 생성
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    studentId,  // 관리자가 선택한 학생 ID
    planGroupData,
    processedContents,
    exclusionsData,  // plan_group_id 설정됨
    schedulesData    // plan_group_id 설정됨
  );
}
```

**현재 동작**:
1. 관리자 인증 확인 (`requireAdminOrConsultant()`)
2. `studentId`는 `options.studentId`로 설정 (관리자가 선택한 학생)
3. 제외일/학원 일정은 선택한 학생의 `student_id`와 `plan_group_id`와 함께 저장

**문제점**:
- 관리자가 여러 학생의 플랜 그룹을 생성할 때 각 학생의 제외일/학원 일정이 중복 저장됨
- 관리자가 학생의 학원 일정을 변경하면 모든 플랜 그룹을 개별적으로 수정해야 함

### 3. Draft 저장 시 (`_savePlanGroupDraft`)

#### 학생 모드

```typescript
async function _savePlanGroupDraft(
  data: PlanGroupCreationData,
  options?: {
    studentId?: string | null;
  }
): Promise<{ groupId: string }> {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "consultant";
  
  if (!isAdmin) {
    // 학생 모드: 현재 사용자가 학생
    const studentAuth = await requireStudentAuth();
    studentId = studentAuth.userId;
  }
  
  // 원자적 플랜 그룹 생성
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    studentId,
    planGroupData,
    processedContents,
    exclusionsData,  // plan_group_id 설정됨
    schedulesData     // plan_group_id 설정됨
  );
}
```

#### 관리자 모드

```typescript
if (isAdmin) {
  // 관리자 모드: student_id를 옵션에서 가져오거나 기존 그룹에서 조회
  await requireAdminOrConsultant();
  
  if (options?.studentId) {
    studentId = options.studentId;
  } else if (options?.draftGroupId) {
    // 기존 그룹에서 student_id 조회
    const existingGroup = await supabase
      .from("plan_groups")
      .select("student_id")
      .eq("id", options.draftGroupId)
      .maybeSingle();
    
    studentId = existingGroup.student_id;
  }
}
```

**현재 동작**:
- Draft 저장 시에도 `plan_group_id`를 설정하여 플랜 그룹별로 저장
- 최종 저장 시에도 동일한 방식으로 저장

---

## 개선 방안

### 1. 전역 관리 전환 전략

#### 핵심 원칙

1. **학생별 전역 관리**
   - `plan_exclusions`: `plan_group_id`를 항상 NULL로 설정
   - `academy_schedules`: `plan_group_id`를 항상 NULL로 설정
   - 학생별로 하나의 제외일/학원 일정 집합만 유지

2. **플랜 그룹과의 관계**
   - 플랜 그룹 생성 시 기존 전역 제외일/학원 일정을 재사용
   - 플랜 그룹별로 제외일/학원 일정을 저장하지 않음
   - 플랜 그룹 조회 시 학생의 전역 제외일/학원 일정을 조회

3. **중복 방지**
   - 제외일: `student_id` + `exclusion_date` + `exclusion_type` 조합으로 중복 체크
   - 학원 일정: `student_id` + `day_of_week` + `start_time` + `end_time` + `academy_id` 조합으로 중복 체크

### 2. 데이터 저장 방식 변경

#### 플랜 그룹 생성 시

**변경 전**:
```typescript
// plan_group_id를 설정하여 저장
const exclusionsData = exclusions.map(e => ({
  student_id: studentId,
  plan_group_id: groupId,  // 플랜 그룹 ID 설정
  exclusion_date: e.exclusion_date,
  exclusion_type: e.exclusion_type,
  reason: e.reason,
}));
```

**변경 후**:
```typescript
// plan_group_id를 NULL로 설정하여 전역 관리
const exclusionsData = exclusions.map(e => ({
  student_id: studentId,
  plan_group_id: null,  // 항상 NULL (전역 관리)
  exclusion_date: e.exclusion_date,
  exclusion_type: e.exclusion_type,
  reason: e.reason,
}));
```

#### 플랜 그룹 업데이트 시

**변경 전**:
```typescript
// 플랜 그룹의 기존 제외일 삭제 후 재생성
await supabase
  .from("plan_exclusions")
  .delete()
  .eq("plan_group_id", groupId);
  
await createPlanExclusions(groupId, tenantId, data.exclusions);
```

**변경 후**:
```typescript
// 학생의 전역 제외일 업데이트 (플랜 그룹과 무관)
await createStudentExclusions(studentId, tenantId, data.exclusions);
// createStudentExclusions는 plan_group_id = NULL로 저장하고 중복 체크 수행
```

### 3. 조회 로직 변경

#### 플랜 그룹 조회 시

**변경 전**:
```typescript
// 플랜 그룹별 제외일 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("*")
  .eq("plan_group_id", groupId);
```

**변경 후**:
```typescript
// 학생의 전역 제외일 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("*")
  .eq("student_id", studentId)
  .is("plan_group_id", null);
```

### 4. RPC 함수 수정

#### `create_plan_group_atomic` 함수

**변경 사항**:
- 제외일 생성 시 `plan_group_id`를 NULL로 설정
- 학원 일정 생성 시 `plan_group_id`를 NULL로 설정
- 중복 체크 로직 추가 (같은 학생의 기존 제외일/학원 일정과 비교)

---

## 마이그레이션 계획

### Phase 1: 데이터 마이그레이션 (1주)

#### 1.1 기존 데이터 통합

**목표**: 플랜 그룹별로 분산된 제외일/학원 일정을 학생별 전역 데이터로 통합

**마이그레이션 SQL**:

```sql
-- 1. 제외일 통합
-- 같은 학생의 같은 날짜+유형의 제외일 중복 제거
WITH ranked_exclusions AS (
  SELECT 
    id,
    student_id,
    exclusion_date,
    exclusion_type,
    reason,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, exclusion_date, exclusion_type 
      ORDER BY created_at DESC
    ) AS rn
  FROM plan_exclusions
  WHERE plan_group_id IS NOT NULL
)
UPDATE plan_exclusions
SET plan_group_id = NULL
WHERE id IN (
  SELECT id FROM ranked_exclusions WHERE rn = 1
);

-- 중복 제거 (같은 학생의 같은 날짜+유형의 제외일 중 가장 최근 것만 유지)
DELETE FROM plan_exclusions
WHERE id IN (
  SELECT id FROM ranked_exclusions WHERE rn > 1
);

-- 2. 학원 일정 통합
-- 같은 학생의 같은 요일+시간+학원의 학원 일정 중복 제거
WITH ranked_schedules AS (
  SELECT 
    id,
    student_id,
    day_of_week,
    start_time,
    end_time,
    academy_id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, day_of_week, start_time, end_time, academy_id 
      ORDER BY created_at DESC
    ) AS rn
  FROM academy_schedules
  WHERE plan_group_id IS NOT NULL
)
UPDATE academy_schedules
SET plan_group_id = NULL
WHERE id IN (
  SELECT id FROM ranked_schedules WHERE rn = 1
);

-- 중복 제거
DELETE FROM academy_schedules
WHERE id IN (
  SELECT id FROM ranked_schedules WHERE rn > 1
);
```

#### 1.2 데이터 검증

**검증 쿼리**:

```sql
-- 제외일 중복 확인
SELECT 
  student_id,
  exclusion_date,
  exclusion_type,
  COUNT(*) as count
FROM plan_exclusions
WHERE plan_group_id IS NULL
GROUP BY student_id, exclusion_date, exclusion_type
HAVING COUNT(*) > 1;

-- 학원 일정 중복 확인
SELECT 
  student_id,
  day_of_week,
  start_time,
  end_time,
  academy_id,
  COUNT(*) as count
FROM academy_schedules
WHERE plan_group_id IS NULL
GROUP BY student_id, day_of_week, start_time, end_time, academy_id
HAVING COUNT(*) > 1;
```

### Phase 2: 코드 수정 (2주)

#### 2.1 RPC 함수 수정

**파일**: `supabase/migrations/YYYYMMDDHHMMSS_update_plan_group_atomic_for_global_management.sql`

```sql
CREATE OR REPLACE FUNCTION create_plan_group_atomic(
  p_tenant_id UUID,
  p_student_id UUID,
  p_plan_group JSONB,
  p_contents JSONB,
  p_exclusions JSONB,
  p_schedules JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id UUID;
  v_exclusion JSONB;
  v_schedule JSONB;
BEGIN
  -- 1. plan_groups 생성 (기존과 동일)
  -- ...
  
  -- 2. plan_contents 생성 (기존과 동일)
  -- ...
  
  -- 3. 제외일 생성 (전역 관리: plan_group_id = NULL)
  IF p_exclusions IS NOT NULL AND jsonb_array_length(p_exclusions) > 0 THEN
    FOR v_exclusion IN SELECT * FROM jsonb_array_elements(p_exclusions)
    LOOP
      -- 중복 체크: 같은 학생의 같은 날짜+유형의 제외일이 이미 있으면 스킵
      IF NOT EXISTS (
        SELECT 1 FROM plan_exclusions
        WHERE student_id = p_student_id
          AND exclusion_date = (v_exclusion->>'exclusion_date')::DATE
          AND exclusion_type = v_exclusion->>'exclusion_type'
          AND plan_group_id IS NULL
      ) THEN
        INSERT INTO plan_exclusions (
          tenant_id,
          student_id,
          plan_group_id,  -- NULL로 설정 (전역 관리)
          exclusion_date,
          exclusion_type,
          reason
        ) VALUES (
          p_tenant_id,
          p_student_id,
          NULL,  -- 항상 NULL
          (v_exclusion->>'exclusion_date')::DATE,
          v_exclusion->>'exclusion_type',
          v_exclusion->>'reason'
        );
      END IF;
    END LOOP;
  END IF;
  
  -- 4. 학원 일정 생성 (전역 관리: plan_group_id = NULL)
  IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
    FOR v_schedule IN SELECT * FROM jsonb_array_elements(p_schedules)
    LOOP
      -- academy_id 찾기 또는 생성 (기존 로직)
      -- ...
      
      -- 중복 체크: 같은 학생의 같은 요일+시간+학원의 일정이 이미 있으면 스킵
      IF NOT EXISTS (
        SELECT 1 FROM academy_schedules
        WHERE student_id = p_student_id
          AND day_of_week = (v_schedule->>'day_of_week')::INTEGER
          AND start_time = (v_schedule->>'start_time')::TIME
          AND end_time = (v_schedule->>'end_time')::TIME
          AND academy_id = v_academy_id
          AND plan_group_id IS NULL
      ) THEN
        INSERT INTO academy_schedules (
          tenant_id,
          student_id,
          plan_group_id,  -- NULL로 설정 (전역 관리)
          academy_id,
          day_of_week,
          start_time,
          end_time,
          academy_name,
          subject,
          travel_time,
          source,
          is_locked
        ) VALUES (
          p_tenant_id,
          p_student_id,
          NULL,  -- 항상 NULL
          v_academy_id,
          (v_schedule->>'day_of_week')::INTEGER,
          (v_schedule->>'start_time')::TIME,
          (v_schedule->>'end_time')::TIME,
          v_schedule->>'academy_name',
          v_schedule->>'subject',
          (v_schedule->>'travel_time')::INTEGER,
          v_schedule->>'source',
          (v_schedule->>'is_locked')::BOOLEAN
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id
  );
END;
$$;
```

#### 2.2 TypeScript 코드 수정

**파일**: `lib/domains/plan/actions/plan-groups/create.ts`

```typescript
// 제외일 데이터 준비 (plan_group_id 제거)
const exclusionsData: ExclusionInput[] = formatExclusionsForDb(processedExclusions);
// RPC 함수에서 plan_group_id = NULL로 설정

// 학원 일정 데이터 준비 (plan_group_id 제거)
const schedulesData: ScheduleInput[] = data.academy_schedules?.map((s) => ({
  day_of_week: s.day_of_week,
  start_time: s.start_time,
  end_time: s.end_time,
  academy_name: s.academy_name || null,
  subject: s.subject || null,
  travel_time: s.travel_time ?? 0,
  source: s.source ?? "student",
  is_locked: s.is_locked ?? false,
})) ?? [];
// RPC 함수에서 plan_group_id = NULL로 설정
```

**파일**: `lib/domains/plan/actions/plan-groups/update.ts`

```typescript
// 제외일 업데이트 (전역 관리로 변경)
if (data.exclusions !== undefined) {
  // 플랜 그룹별 제외일 삭제 로직 제거
  // 학생의 전역 제외일 업데이트
  const exclusionsResult = await createStudentExclusions(
    studentId,  // 플랜 그룹의 student_id
    tenantContext.tenantId,
    data.exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason || null,
    }))
  );
  
  if (!exclusionsResult.success) {
    throw new AppError(
      exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

// 학원 일정 업데이트 (전역 관리로 변경)
if (data.academy_schedules !== undefined) {
  // 플랜 그룹별 학원 일정 삭제 로직 제거
  // 학생의 전역 학원 일정 업데이트
  const schedulesResult = await createStudentAcademySchedules(
    studentId,  // 플랜 그룹의 student_id
    tenantContext.tenantId,
    data.academy_schedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name || null,
      subject: s.subject || null,
    }))
  );
  
  if (!schedulesResult.success) {
    throw new AppError(
      schedulesResult.error || "학원 일정 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}
```

#### 2.3 조회 로직 수정

**파일**: `lib/domains/plan/actions/plan-groups/queries.ts`

```typescript
// 플랜 그룹 조회 시 학생의 전역 제외일/학원 일정 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("*")
  .eq("student_id", studentId)
  .is("plan_group_id", null);  // 전역 제외일만 조회

const { data: academySchedules } = await supabase
  .from("academy_schedules")
  .select("*")
  .eq("student_id", studentId)
  .is("plan_group_id", null);  // 전역 학원 일정만 조회
```

### Phase 3: 테스트 및 검증 (1주)

#### 3.1 단위 테스트

- 제외일 생성 테스트 (중복 체크)
- 학원 일정 생성 테스트 (중복 체크)
- 플랜 그룹 생성 테스트 (전역 제외일/학원 일정 재사용)
- 플랜 그룹 업데이트 테스트 (전역 제외일/학원 일정 업데이트)

#### 3.2 통합 테스트

- 학생이 여러 플랜 그룹 생성 시나리오
- 관리자가 여러 학생의 플랜 그룹 생성 시나리오
- 플랜 그룹 삭제 시나리오 (제외일/학원 일정 유지 확인)

#### 3.3 성능 테스트

- 대량 데이터 마이그레이션 성능
- 플랜 그룹 조회 성능 (전역 제외일/학원 일정 조회)

---

## 구현 상세

### 1. 학생이 직접 플랜 그룹 생성 시

#### 변경 전

```typescript
// 1. 학생 인증
const studentAuth = await requireStudentAuth();
const studentId = studentAuth.userId;

// 2. 제외일/학원 일정 데이터 준비
const exclusionsData = formatExclusionsForDb(data.exclusions);
const schedulesData = data.academy_schedules?.map(...) ?? [];

// 3. RPC 호출 (plan_group_id 설정)
await createPlanGroupAtomic(
  tenantId,
  studentId,
  planGroupData,
  contents,
  exclusionsData,  // plan_group_id = groupId로 저장
  schedulesData    // plan_group_id = groupId로 저장
);
```

#### 변경 후

```typescript
// 1. 학생 인증 (변경 없음)
const studentAuth = await requireStudentAuth();
const studentId = studentAuth.userId;

// 2. 제외일/학원 일정 데이터 준비 (변경 없음)
const exclusionsData = formatExclusionsForDb(data.exclusions);
const schedulesData = data.academy_schedules?.map(...) ?? [];

// 3. RPC 호출 (plan_group_id = NULL로 저장)
await createPlanGroupAtomic(
  tenantId,
  studentId,
  planGroupData,
  contents,
  exclusionsData,  // RPC 내부에서 plan_group_id = NULL로 저장, 중복 체크
  schedulesData    // RPC 내부에서 plan_group_id = NULL로 저장, 중복 체크
);
```

**주요 변경점**:
- RPC 함수 내부에서 `plan_group_id = NULL`로 설정
- 중복 체크 로직 추가 (같은 학생의 기존 제외일/학원 일정과 비교)

### 2. 관리자가 학생을 선택해서 플랜 그룹 생성 시

#### 변경 전

```typescript
// 1. 관리자 인증
await requireAdminOrConsultant();
const studentId = options.studentId;  // 관리자가 선택한 학생 ID

// 2. 제외일/학원 일정 데이터 준비
const exclusionsData = formatExclusionsForDb(data.exclusions);
const schedulesData = data.academy_schedules?.map(...) ?? [];

// 3. RPC 호출 (plan_group_id 설정)
await createPlanGroupAtomic(
  tenantId,
  studentId,  // 관리자가 선택한 학생 ID
  planGroupData,
  contents,
  exclusionsData,  // plan_group_id = groupId로 저장
  schedulesData     // plan_group_id = groupId로 저장
);
```

#### 변경 후

```typescript
// 1. 관리자 인증 (변경 없음)
await requireAdminOrConsultant();
const studentId = options.studentId;  // 관리자가 선택한 학생 ID

// 2. 제외일/학원 일정 데이터 준비 (변경 없음)
const exclusionsData = formatExclusionsForDb(data.exclusions);
const schedulesData = data.academy_schedules?.map(...) ?? [];

// 3. RPC 호출 (plan_group_id = NULL로 저장)
await createPlanGroupAtomic(
  tenantId,
  studentId,  // 관리자가 선택한 학생 ID
  planGroupData,
  contents,
  exclusionsData,  // RPC 내부에서 plan_group_id = NULL로 저장, 중복 체크
  schedulesData     // RPC 내부에서 plan_group_id = NULL로 저장, 중복 체크
);
```

**주요 변경점**:
- 관리자가 선택한 학생의 `student_id`를 사용
- RPC 함수 내부에서 `plan_group_id = NULL`로 설정
- 중복 체크 로직 추가 (선택한 학생의 기존 제외일/학원 일정과 비교)

### 3. 플랜 그룹 업데이트 시

#### 변경 전

```typescript
// 제외일 업데이트
if (data.exclusions !== undefined) {
  // 1. 플랜 그룹의 기존 제외일 삭제
  await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);
  
  // 2. 새로운 제외일 추가 (plan_group_id = groupId)
  await createPlanExclusions(groupId, tenantId, data.exclusions);
}

// 학원 일정 업데이트
if (data.academy_schedules !== undefined) {
  // 1. 플랜 그룹의 기존 학원 일정 삭제
  await supabase
    .from("academy_schedules")
    .delete()
    .eq("plan_group_id", groupId);
  
  // 2. 새로운 학원 일정 추가 (plan_group_id = groupId)
  await createPlanAcademySchedules(groupId, tenantId, data.academy_schedules);
}
```

#### 변경 후

```typescript
// 플랜 그룹의 student_id 조회
const { data: group } = await supabase
  .from("plan_groups")
  .select("student_id")
  .eq("id", groupId)
  .single();
  
const studentId = group.student_id;

// 제외일 업데이트 (전역 관리)
if (data.exclusions !== undefined) {
  // 학생의 전역 제외일 업데이트 (plan_group_id = NULL)
  await createStudentExclusions(
    studentId,
    tenantId,
    data.exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason || null,
    }))
  );
  // createStudentExclusions는 중복 체크 후 plan_group_id = NULL로 저장
}

// 학원 일정 업데이트 (전역 관리)
if (data.academy_schedules !== undefined) {
  // 학생의 전역 학원 일정 업데이트 (plan_group_id = NULL)
  await createStudentAcademySchedules(
    studentId,
    tenantId,
    data.academy_schedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name || null,
      subject: s.subject || null,
    }))
  );
  // createStudentAcademySchedules는 중복 체크 후 plan_group_id = NULL로 저장
}
```

**주요 변경점**:
- 플랜 그룹별 삭제 로직 제거
- 학생의 전역 제외일/학원 일정 업데이트로 변경
- `createStudentExclusions` / `createStudentAcademySchedules` 사용 (plan_group_id = NULL)

### 4. 조회 로직 변경

#### 변경 전

```typescript
// 플랜 그룹 조회 시
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("*")
  .eq("plan_group_id", groupId);  // 플랜 그룹별 조회

const { data: academySchedules } = await supabase
  .from("academy_schedules")
  .select("*")
  .eq("plan_group_id", groupId);  // 플랜 그룹별 조회
```

#### 변경 후

```typescript
// 플랜 그룹 조회 시
const { data: group } = await supabase
  .from("plan_groups")
  .select("student_id")
  .eq("id", groupId)
  .single();

const studentId = group.student_id;

// 학생의 전역 제외일/학원 일정 조회
const { data: exclusions } = await supabase
  .from("plan_exclusions")
  .select("*")
  .eq("student_id", studentId)
  .is("plan_group_id", null);  // 전역 제외일만 조회

const { data: academySchedules } = await supabase
  .from("academy_schedules")
  .select("*")
  .eq("student_id", studentId)
  .is("plan_group_id", null);  // 전역 학원 일정만 조회
```

**주요 변경점**:
- 플랜 그룹의 `student_id`를 먼저 조회
- 학생의 전역 제외일/학원 일정 조회 (`plan_group_id IS NULL`)

---

## 테스트 계획

### 1. 단위 테스트

#### 1.1 제외일 생성 테스트

**시나리오 1: 새로운 제외일 추가**
```typescript
// Given: 학생 A의 제외일이 없음
// When: 학생 A의 제외일 추가 (2025-01-01, 신정)
// Then: plan_group_id = NULL로 저장됨
```

**시나리오 2: 중복 제외일 추가 시도**
```typescript
// Given: 학생 A의 제외일이 이미 있음 (2025-01-01, 신정)
// When: 같은 제외일 추가 시도
// Then: 중복 체크로 인해 스킵됨 (에러 없음)
```

#### 1.2 학원 일정 생성 테스트

**시나리오 1: 새로운 학원 일정 추가**
```typescript
// Given: 학생 A의 학원 일정이 없음
// When: 학생 A의 학원 일정 추가 (월요일, 15:00-17:00, 수학)
// Then: plan_group_id = NULL로 저장됨
```

**시나리오 2: 중복 학원 일정 추가 시도**
```typescript
// Given: 학생 A의 학원 일정이 이미 있음 (월요일, 15:00-17:00, 수학)
// When: 같은 학원 일정 추가 시도
// Then: 중복 체크로 인해 스킵됨 (에러 없음)
```

### 2. 통합 테스트

#### 2.1 학생이 여러 플랜 그룹 생성 시나리오

**시나리오**:
1. 학생 A가 "2025년 1학기 학습 계획" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정), 2025-03-01 (삼일절)
   - 학원 일정: 월요일 15:00-17:00 (수학)

2. 학생 A가 "2025년 여름방학 특강" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정), 2025-08-15 (광복절)
   - 학원 일정: 월요일 15:00-17:00 (수학)

**검증**:
- 제외일: 2025-01-01 (신정), 2025-03-01 (삼일절), 2025-08-15 (광복절) 3개만 저장됨 (중복 제거)
- 학원 일정: 월요일 15:00-17:00 (수학) 1개만 저장됨 (중복 제거)
- 두 플랜 그룹 모두 같은 전역 제외일/학원 일정을 참조

#### 2.2 관리자가 여러 학생의 플랜 그룹 생성 시나리오

**시나리오**:
1. 관리자가 학생 A의 "2025년 1학기 학습 계획" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정)
   - 학원 일정: 월요일 15:00-17:00 (수학)

2. 관리자가 학생 B의 "2025년 1학기 학습 계획" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정)
   - 학원 일정: 월요일 15:00-17:00 (수학)

**검증**:
- 학생 A의 제외일/학원 일정: 학생 A의 전역 데이터로 저장됨
- 학생 B의 제외일/학원 일정: 학생 B의 전역 데이터로 저장됨
- 두 학생의 데이터가 서로 독립적으로 관리됨

#### 2.3 플랜 그룹 업데이트 시나리오

**시나리오**:
1. 학생 A가 "2025년 1학기 학습 계획" 플랜 그룹 생성
   - 학원 일정: 월요일 15:00-17:00 (수학)

2. 학생 A가 같은 플랜 그룹 업데이트
   - 학원 일정: 월요일 14:00-16:00 (수학) (시간 변경)

**검증**:
- 기존 학원 일정 (월요일 15:00-17:00)이 업데이트됨
- 새로운 학원 일정 (월요일 14:00-16:00)이 저장됨
- 다른 플랜 그룹에서도 업데이트된 학원 일정이 반영됨

#### 2.4 플랜 그룹 삭제 시나리오

**시나리오**:
1. 학생 A가 "2025년 1학기 학습 계획" 플랜 그룹 생성
   - 제외일: 2025-01-01 (신정)
   - 학원 일정: 월요일 15:00-17:00 (수학)

2. 학생 A가 플랜 그룹 삭제

**검증**:
- 플랜 그룹이 삭제됨
- 제외일/학원 일정은 유지됨 (plan_group_id = NULL로 이미 저장되어 있음)
- 다른 플랜 그룹에서도 제외일/학원 일정을 계속 사용할 수 있음

### 3. 성능 테스트

#### 3.1 대량 데이터 마이그레이션 성능

**시나리오**:
- 1000명의 학생
- 각 학생당 평균 5개의 플랜 그룹
- 각 플랜 그룹당 평균 10개의 제외일, 5개의 학원 일정

**목표**:
- 마이그레이션 완료 시간: 10분 이내
- 데이터 무결성: 100% 유지

#### 3.2 플랜 그룹 조회 성능

**시나리오**:
- 학생의 전역 제외일/학원 일정 조회
- 학생당 평균 50개의 제외일, 20개의 학원 일정

**목표**:
- 조회 응답 시간: 100ms 이내
- 인덱스 활용: `student_id` + `plan_group_id` 복합 인덱스

---

## 예상 효과

### 1. 데이터 중복 제거

**Before**:
- 학생이 5개의 플랜 그룹을 생성하면 같은 제외일/학원 일정이 5번 저장됨
- 100명의 학생 × 5개 플랜 그룹 × 10개 제외일 = 5,000개 레코드

**After**:
- 학생별로 제외일/학원 일정이 1번만 저장됨
- 100명의 학생 × 10개 제외일 = 1,000개 레코드
- **80% 데이터 감소**

### 2. 사용자 경험 개선

**Before**:
- 학생이 학원 일정을 변경하면 모든 플랜 그룹을 개별적으로 수정해야 함
- 사용자 혼란 및 불편함

**After**:
- 학생이 학원 일정을 한 번만 변경하면 모든 플랜 그룹에 자동 반영됨
- 사용자 편의성 향상

### 3. 데이터 일관성 보장

**Before**:
- 플랜 그룹별로 독립 관리되어 데이터 불일치 가능
- 한 플랜 그룹에서 수정해도 다른 플랜 그룹에 반영 안 됨

**After**:
- 학생별 전역 관리로 데이터 일관성 보장
- 한 번 수정하면 모든 플랜 그룹에 자동 반영

### 4. 관리 복잡도 감소

**Before**:
- 플랜 그룹별로 제외일/학원 일정을 개별 관리
- 중복 데이터로 인한 관리 복잡도 증가

**After**:
- 학생별 전역 관리로 관리 복잡도 감소
- 중복 데이터 제거로 유지보수 용이

---

## 리스크 및 대응 방안

### 1. 마이그레이션 실패 리스크

**리스크**: 대량 데이터 마이그레이션 중 실패 시 데이터 손실 가능

**대응 방안**:
- 마이그레이션 전 전체 데이터 백업
- 트랜잭션 내에서 마이그레이션 수행
- 단계별 검증 및 롤백 계획 수립

### 2. 기존 기능 호환성 리스크

**리스크**: 기존 코드가 `plan_group_id`를 기반으로 조회하는 경우

**대응 방안**:
- 모든 조회 로직 점검 및 수정
- 통합 테스트로 호환성 검증
- 단계적 배포로 리스크 최소화

### 3. 성능 저하 리스크

**리스크**: 전역 조회 시 인덱스 미활용으로 성능 저하 가능

**대응 방안**:
- `student_id` + `plan_group_id` 복합 인덱스 생성
- 조회 쿼리 최적화
- 성능 테스트로 검증

---

## 결론

### 개선 효과 요약

1. **데이터 중복 제거**: 80% 데이터 감소 예상
2. **사용자 경험 개선**: 한 번 수정으로 모든 플랜 그룹에 자동 반영
3. **데이터 일관성 보장**: 학생별 전역 관리로 일관성 유지
4. **관리 복잡도 감소**: 중복 데이터 제거로 유지보수 용이

### 권장 구현 순서

1. **Phase 1 (1주)**: 데이터 마이그레이션
   - 기존 데이터 통합
   - 데이터 검증

2. **Phase 2 (2주)**: 코드 수정
   - RPC 함수 수정
   - TypeScript 코드 수정
   - 조회 로직 수정

3. **Phase 3 (1주)**: 테스트 및 검증
   - 단위 테스트
   - 통합 테스트
   - 성능 테스트

### 다음 단계

1. 마이그레이션 스크립트 작성
2. RPC 함수 수정
3. TypeScript 코드 수정
4. 테스트 코드 작성
5. 단계적 배포

---

*최종 업데이트: 2025-02-02*

