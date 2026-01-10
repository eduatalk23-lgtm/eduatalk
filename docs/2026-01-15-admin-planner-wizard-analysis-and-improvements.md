# 관리자 영역 플래너 생성 위저드 분석 및 개선 방향

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: 분석 완료, 개선 방향 제시

---

## 📋 목차

1. [개요](#개요)
2. [현재 구조 분석](#현재-구조-분석)
3. [문제점 분석](#문제점-분석)
4. [7단계 위저드 구성 컴포넌트 상세 분석](#7단계-위저드-구성-컴포넌트-상세-분석)
5. [학원 일정 및 제외일 처리 현황](#학원-일정-및-제외일-처리-현황)
6. [개선 방향](#개선-방향)
7. [구현 계획](#구현-계획)

---

## 개요

### 목적

관리자 영역에서 학생 대상으로 플랜 그룹을 생성하는 7단계 위저드 기능을 검토하고, 특히 **학원 일정 및 제외일**이 제대로 반영되지 않는 문제를 분석하여 개선 방향을 제시합니다.

### 현재 상황

- **위저드 위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/`
- **주요 컴포넌트**: `AdminPlanCreationWizard7Step.tsx`
- **플래너 연동**: Step 1에서 플래너 선택 시 자동 채우기 기능 존재
- **문제점**: 플래너를 선택하지 않았을 때 학원 일정 및 제외일이 자동으로 반영되지 않음

---

## 현재 구조 분석

### 위저드 아키텍처

```
AdminPlanCreationWizard7Step
├── AdminWizardProvider (Context)
│   ├── AdminWizardDataContext (데이터 관리)
│   ├── AdminWizardStepContext (단계 네비게이션)
│   └── AdminWizardValidationContext (검증)
└── WizardInner
    ├── Step1BasicInfo (기본 정보)
    ├── Step2TimeSettings (시간 설정)
    ├── Step3SchedulePreview (스케줄 미리보기)
    ├── Step4ContentSelection (콘텐츠 선택)
    ├── Step5AllocationSettings (배분 설정)
    ├── Step6FinalReview (최종 검토)
    └── Step7GenerateResult (생성 및 결과)
```

### 데이터 흐름

```typescript
// AdminWizardData 타입 정의
interface AdminWizardData {
  // 플래너 연결 (선택적)
  plannerId?: string | null;

  // Step 1: 기본 정보
  name: string;
  planPurpose: PlanPurpose;
  periodStart: string;
  periodEnd: string;
  targetDate?: string;
  blockSetId?: string;

  // Step 2: 시간 설정
  schedulerType: "1730_timetable" | "custom" | "";
  academySchedules: AcademySchedule[];
  exclusions: ExclusionSchedule[];

  // Step 2: 플래너 호환 시간 설정
  studyHours?: TimeRange | null;
  selfStudyHours?: TimeRange | null;
  lunchTime?: TimeRange | null;
  nonStudyTimeBlocks?: NonStudyTimeBlock[];

  // Step 4: 콘텐츠 선택
  selectedContents: SelectedContent[];
  skipContents: boolean;

  // Step 5: 배분 설정
  schedulerOptions: SchedulerOptions;

  // Step 7: 생성 옵션
  generateAIPlan: boolean;
  aiMode?: "hybrid" | "ai-only";
}
```

---

## 문제점 분석

### 1. 플래너 선택 시에만 학원 일정/제외일 반영

**현재 동작**:

- Step 1에서 플래너를 **명시적으로 선택**한 경우에만 플래너의 학원 일정과 제외일이 자동으로 채워짐
- 플래너를 선택하지 않으면 수동으로 추가해야 함

**문제점**:

- 학생에게 이미 활성 플래너가 연결되어 있는 경우, 플래너를 선택하지 않으면 해당 플래너의 설정이 반영되지 않음
- 관리자가 플래너를 선택하는 것을 잊어버리면 학원 일정과 제외일이 누락될 수 있음

**코드 위치**: `Step1BasicInfo.tsx` (188-294줄)

```typescript
// 플래너 선택 핸들러
const handlePlannerSelect = useCallback(
  async (id: string | undefined) => {
    // 플래너 선택 해제 시: 상속 설정 정리
    if (!id) {
      updateData({
        plannerId: undefined,
        exclusions: wizardData.exclusions.filter((e) => !e.is_locked),
        academySchedules: wizardData.academySchedules.filter(
          (s) => !s.is_locked
        ),
      });
      return;
    }

    // 플래너 상세 정보 로드 후 자동 채우기
    const planner = await getPlannerAction(id, true);
    // ... 학원 일정 및 제외일 매핑
  },
  [updateData, wizardData]
);
```

### 2. 플래너 기간과 플랜 그룹 기간 불일치 시 필터링 부재

**현재 동작**:

- 플래너를 선택하면 플래너의 전체 기간에 대한 학원 일정과 제외일을 모두 가져옴
- 플랜 그룹의 기간(`periodStart`, `periodEnd`)과 플래너의 기간이 다를 수 있음

**문제점**:

- 플래너 기간이 `2026-01-01 ~ 2026-12-31`이고, 플랜 그룹 기간이 `2026-06-01 ~ 2026-06-30`인 경우
- 플래너의 모든 학원 일정과 제외일이 가져와지지만, 실제로는 6월 기간에 해당하는 것만 필요함
- 불필요한 데이터가 포함되어 혼란을 야기할 수 있음

**코드 위치**: `Step1BasicInfo.tsx` (235-277줄)

```typescript
// 제외일 매핑 (기간 필터링 없음)
if (planner.exclusions && planner.exclusions.length > 0) {
  const plannerExclusions: ExclusionSchedule[] = planner.exclusions.map(
    (e) => ({
      exclusion_date: e.exclusionDate,
      exclusion_type: mapExclusionType(e.exclusionType),
      reason: e.reason ?? undefined,
      source: "planner",
      is_locked: true,
    })
  );
  autoFillData.exclusions = [...plannerExclusions, ...manualExclusions];
}

// 학원 일정 매핑 (기간 필터링 없음)
if (planner.academySchedules && planner.academySchedules.length > 0) {
  const plannerAcademySchedules: AcademySchedule[] =
    planner.academySchedules.map((s) => ({
      // ... 매핑
      is_locked: true,
    }));
  autoFillData.academySchedules = [
    ...plannerAcademySchedules,
    ...manualAcademySchedules,
  ];
}
```

### 3. 플래너 미선택 시 자동 로드 부재

**현재 동작**:

- 플래너를 선택하지 않으면 학생에게 연결된 활성 플래너가 있어도 자동으로 가져오지 않음
- 관리자가 수동으로 플래너를 선택해야 함

**문제점**:

- 학생에게 이미 활성 플래너가 있는 경우, 관리자가 플래너를 선택하는 것을 잊어버리면 설정이 누락됨
- 사용자 경험이 좋지 않음

**개선 필요**:

- Step 1 초기 로드 시 학생에게 연결된 활성 플래너가 있으면 자동으로 제안
- 또는 Step 2에서 플래너의 학원 일정과 제외일을 참고할 수 있도록 표시

### 4. Step 2에서 플래너 정보 표시 부족

**현재 동작**:

- Step 2에서 플래너에서 상속된 시간 설정(`studyHours`, `selfStudyHours`, `lunchTime`)은 표시됨
- 하지만 플래너의 학원 일정과 제외일이 플래너에서 가져온 것인지 수동으로 추가한 것인지 구분이 어려움

**코드 위치**: `Step2TimeSettings.tsx` (241-341줄)

```typescript
// 플래너 상속 시간 설정 표시 (읽기 전용)
{hasInheritedTimeSettings && (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Lock className="h-4 w-4 text-blue-500" />
      <label>플래너에서 상속된 시간 설정</label>
      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        읽기 전용
      </span>
    </div>
    {/* 시간 설정 표시 */}
  </div>
)}
```

**문제점**:

- 학원 일정과 제외일 목록에서 `is_locked` 표시는 있지만, 플래너에서 가져온 것임을 명확히 표시하지 않음
- 플래너를 선택하지 않았을 때 플래너의 학원 일정과 제외일을 참고할 수 있는 방법이 없음

---

## 7단계 위저드 구성 컴포넌트 상세 분석

### Step 1: 기본 정보 (`Step1BasicInfo.tsx`)

**역할**:

- 플래너 선택 (선택적)
- 학습 기간 설정
- 플랜 이름 입력
- 학습 목적 선택
- 블록셋 선택

**플래너 연동 로직**:

- `getStudentPlannersAction`: 학생의 플래너 목록 조회
- `getPlannerAction`: 선택한 플래너의 상세 정보 조회
- 플래너 선택 시 자동 채우기:
  - 기간 (`periodStart`, `periodEnd`)
  - 블록셋 (`blockSetId`)
  - 시간 설정 (`studyHours`, `selfStudyHours`, `lunchTime`, `nonStudyTimeBlocks`)
  - 학원 일정 (`academySchedules`) - `is_locked: true`
  - 제외일 (`exclusions`) - `is_locked: true`
  - 스케줄러 타입 및 옵션

**문제점**:

1. 플래너를 선택하지 않으면 학원 일정/제외일이 자동으로 채워지지 않음
2. 플래너 기간과 플랜 그룹 기간이 다를 때 필터링하지 않음
3. 학생에게 활성 플래너가 있어도 자동으로 제안하지 않음

### Step 2: 시간 설정 (`Step2TimeSettings.tsx`)

**역할**:

- 스케줄러 타입 선택 (1730 시간표 / 맞춤 설정)
- 학원 스케줄 추가/삭제
- 제외 일정 추가/삭제
- 플래너에서 상속된 시간 설정 표시 (읽기 전용)

**학원 일정 관리**:

- 수동 추가 가능
- 플래너에서 가져온 항목은 `is_locked: true`로 표시되어 삭제 불가
- 요일별 학원 일정 관리

**제외일 관리**:

- 수동 추가 가능
- 플래너에서 가져온 항목은 `is_locked: true`로 표시되어 삭제 불가
- 제외일 타입: `holiday`, `event`, `personal`

**문제점**:

1. 플래너를 선택하지 않았을 때 플래너의 학원 일정/제외일을 참고할 수 없음
2. 플래너에서 가져온 항목임을 명확히 표시하지 않음 (현재는 `is_locked`만 표시)

### Step 3: 스케줄 미리보기 (`Step3SchedulePreview.tsx`)

**역할**:

- 설정된 블록과 제외일 기반 스케줄 미리보기
- 일간/주간 뷰 전환
- 설정 수정 링크 (Step 2로 이동)

**현황**:

- 학원 일정과 제외일이 제대로 반영되어 표시됨
- 문제 없음

### Step 4: 콘텐츠 선택 (`Step4ContentSelection.tsx`)

**역할**:

- 학습할 콘텐츠 선택
- 콘텐츠 범위 설정

**현황**:

- 학원 일정/제외일과 무관
- 문제 없음

### Step 5: 배분 설정 (`Step5AllocationSettings.tsx`)

**역할**:

- 콘텐츠 배분 방식 설정
- 과목별 배분 비율 설정

**현황**:

- 학원 일정/제외일과 무관
- 문제 없음

### Step 6: 최종 검토 (`Step6FinalReview.tsx`)

**역할**:

- 최종 설정 검토
- 설정 요약 표시

**현황**:

- 학원 일정/제외일 요약 표시 필요 (현재 확인 필요)

### Step 7: 생성 및 결과 (`Step7GenerateResult.tsx`)

**역할**:

- 플랜 그룹 생성 실행
- 진행 상태 표시
- 결과 및 다음 단계 안내

**현황**:

- 학원 일정/제외일이 제대로 저장되는지 확인 필요

---

## 학원 일정 및 제외일 처리 현황

### 데이터 저장 구조

#### 학원 일정 (`academy_schedules` 테이블)

```sql
CREATE TABLE academy_schedules (
  id UUID PRIMARY KEY,
  plan_group_id UUID REFERENCES plan_groups(id),
  day_of_week INTEGER,  -- 0=일, 1=월, ..., 6=토
  start_time TIME,
  end_time TIME,
  academy_name TEXT,
  subject TEXT,
  travel_time INTEGER,  -- 이동시간 (분)
  source TEXT,  -- 'manual', 'imported', 'planner'
  is_locked BOOLEAN DEFAULT FALSE
);
```

#### 제외일 (`plan_exclusions` 테이블)

```sql
CREATE TABLE plan_exclusions (
  id UUID PRIMARY KEY,
  plan_group_id UUID REFERENCES plan_groups(id),
  exclusion_date DATE,
  exclusion_type TEXT,  -- '휴가', '개인사정', '휴일지정', '기타'
  reason TEXT,
  source TEXT,  -- 'manual', 'template', 'planner'
  is_locked BOOLEAN DEFAULT FALSE
);
```

### 플래너 연동 구조

#### 플래너 테이블 (`planners`)

```sql
CREATE TABLE planners (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  name TEXT,
  period_start DATE,
  period_end DATE,
  -- ... 기타 필드
);
```

#### 플래너 제외일 (`planner_exclusions`)

```sql
CREATE TABLE planner_exclusions (
  id UUID PRIMARY KEY,
  planner_id UUID REFERENCES planners(id),
  exclusion_date DATE,
  exclusion_type TEXT,  -- '휴가', '개인사정', '휴일지정', '기타'
  reason TEXT,
  source TEXT,
  is_locked BOOLEAN DEFAULT FALSE
);
```

#### 플래너 학원 일정 (`planner_academy_schedules`)

```sql
CREATE TABLE planner_academy_schedules (
  id UUID PRIMARY KEY,
  planner_id UUID REFERENCES planners(id),
  day_of_week INTEGER,
  start_time TIME,
  end_time TIME,
  academy_name TEXT,
  subject TEXT,
  travel_time INTEGER,
  source TEXT,
  is_locked BOOLEAN DEFAULT FALSE
);
```

### 현재 처리 흐름

1. **Step 1에서 플래너 선택**:
   - `getPlannerAction(id, true)` 호출
   - 플래너의 `exclusions`와 `academySchedules` 가져오기
   - 위저드 데이터에 매핑 (`is_locked: true`)

2. **Step 2에서 표시**:
   - 학원 일정 목록 표시 (플래너에서 가져온 항목은 `is_locked` 표시)
   - 제외일 목록 표시 (플래너에서 가져온 항목은 `is_locked` 표시)

3. **Step 7에서 저장**:
   - `createPlanGroupAction` 호출
   - `academy_schedules`와 `plan_exclusions` 테이블에 저장

### 문제점 요약

1. **플래너 미선택 시 자동 로드 부재**: 학생에게 활성 플래너가 있어도 자동으로 가져오지 않음
2. **기간 필터링 부재**: 플래너 기간과 플랜 그룹 기간이 다를 때 불필요한 데이터 포함
3. **표시 개선 필요**: 플래너에서 가져온 항목임을 더 명확히 표시

---

## 개선 방향

### 1. 플래너 자동 제안 기능

**목표**: 학생에게 활성 플래너가 있으면 Step 1에서 자동으로 제안

**구현 방안**:

- Step 1 초기 로드 시 `getStudentPlannersAction`으로 활성 플래너 조회
- 활성 플래너가 1개인 경우 자동으로 선택 제안 (자동 선택은 하지 않고 제안만)
- 활성 플래너가 여러 개인 경우 드롭다운에 표시

**코드 위치**: `Step1BasicInfo.tsx`

```typescript
// 초기 로드 시 활성 플래너 확인
useEffect(() => {
  async function loadAndSuggestPlanner() {
    const result = await getStudentPlannersAction(studentId, {
      status: ["active"],
      includeArchived: false,
    });

    if (result && "data" in result && result.data.length === 1) {
      // 활성 플래너가 1개인 경우 제안
      setSuggestedPlanner(result.data[0]);
    }
  }
  loadAndSuggestPlanner();
}, [studentId]);
```

### 2. 기간 필터링 로직 추가

**목표**: 플래너의 학원 일정과 제외일을 플랜 그룹 기간에 맞게 필터링

**구현 방안**:

- 플래너 선택 시 플랜 그룹의 `periodStart`와 `periodEnd` 확인
- 제외일: `exclusion_date`가 플랜 그룹 기간 내에 있는 것만 포함
- 학원 일정: 요일 기반이므로 그대로 포함 (기간 필터링 불필요)

**코드 위치**: `Step1BasicInfo.tsx` (235-277줄)

```typescript
// 제외일 매핑 (기간 필터링 추가)
if (planner.exclusions && planner.exclusions.length > 0) {
  const filteredExclusions = planner.exclusions.filter((e) => {
    if (!periodStart || !periodEnd) return true;
    return e.exclusionDate >= periodStart && e.exclusionDate <= periodEnd;
  });

  const plannerExclusions: ExclusionSchedule[] = filteredExclusions.map(
    (e) => ({
      exclusion_date: e.exclusionDate,
      exclusion_type: mapExclusionType(e.exclusionType),
      reason: e.reason ?? undefined,
      source: "planner",
      is_locked: true,
    })
  );
  autoFillData.exclusions = [...plannerExclusions, ...manualExclusions];
}
```

### 3. Step 2 UI 개선

**목표**: 플래너에서 가져온 학원 일정/제외일을 더 명확히 표시

**구현 방안**:

- 플래너에서 가져온 항목에 "플래너에서 상속" 배지 추가
- 플래너를 선택하지 않았을 때도 플래너의 학원 일정/제외일을 참고할 수 있는 섹션 추가 (읽기 전용)

**코드 위치**: `Step2TimeSettings.tsx`

```typescript
// 학원 일정 목록에 플래너 표시 개선
{schedule.is_locked && (
  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
    플래너
  </span>
)}
```

### 4. 플래너 미선택 시 참고 정보 표시

**목표**: 플래너를 선택하지 않았을 때도 학생의 활성 플래너 정보를 참고할 수 있도록 표시

**구현 방안**:

- Step 2에서 학생의 활성 플래너 조회
- 플래너의 학원 일정과 제외일을 읽기 전용으로 표시 (참고용)
- "플래너에서 가져오기" 버튼 제공

**코드 위치**: `Step2TimeSettings.tsx`

```typescript
// 플래너 미선택 시 참고 정보 표시
{!plannerId && activePlanner && (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">
          참고: 활성 플래너 "{activePlanner.name}"의 설정
        </p>
        <p className="text-xs text-gray-500">
          학원 일정 {activePlanner.academySchedules?.length || 0}개,
          제외일 {activePlanner.exclusions?.length || 0}개
        </p>
      </div>
      <button
        onClick={() => handlePlannerSelect(activePlanner.id)}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
      >
        플래너에서 가져오기
      </button>
    </div>
  </div>
)}
```

---

## 구현 계획

### Phase 1: 기간 필터링 추가 (우선순위: 높음)

**작업 내용**:

1. `Step1BasicInfo.tsx`의 `handlePlannerSelect` 함수 수정
2. 플래너 제외일을 플랜 그룹 기간에 맞게 필터링
3. 테스트: 플래너 기간과 플랜 그룹 기간이 다른 경우

**예상 소요 시간**: 2시간

### Phase 2: 플래너 자동 제안 (우선순위: 중간)

**작업 내용**:

1. `Step1BasicInfo.tsx`에 활성 플래너 자동 제안 로직 추가
2. 활성 플래너가 1개인 경우 제안 UI 표시
3. 테스트: 활성 플래너가 있는 경우와 없는 경우

**예상 소요 시간**: 3시간

### Phase 3: Step 2 UI 개선 (우선순위: 중간)

**작업 내용**:

1. `Step2TimeSettings.tsx`에서 플래너에서 가져온 항목 표시 개선
2. 플래너 미선택 시 참고 정보 표시 섹션 추가
3. 테스트: 플래너 선택/미선택 시나리오

**예상 소요 시간**: 4시간

### Phase 4: 통합 테스트 및 문서화 (우선순위: 낮음)

**작업 내용**:

1. 전체 플로우 테스트
2. 사용자 가이드 문서 작성
3. 코드 리뷰 및 리팩토링

**예상 소요 시간**: 2시간

---

## 참고 파일

### 주요 컴포넌트

- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step1BasicInfo.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/types.ts`

### 관련 액션

- `lib/domains/admin-plan/actions/planners.ts` - 플래너 조회 액션
- `lib/domains/plan/actions/plan-groups/create.ts` - 플랜 그룹 생성 액션

### 관련 문서

- `docs/2025-02-02-plan-creation-features-comprehensive-analysis.md` - 플랜 생성 기능 통합 분석
- `docs/calendar-exclusion-type-differentiation.md` - 제외일 타입별 차별화 처리

---

## 결론

관리자 영역 플래너 생성 위저드에서 학원 일정 및 제외일이 제대로 반영되지 않는 주요 원인은:

1. **플래너 미선택 시 자동 로드 부재**: 학생에게 활성 플래너가 있어도 자동으로 가져오지 않음
2. **기간 필터링 부재**: 플래너 기간과 플랜 그룹 기간이 다를 때 불필요한 데이터 포함
3. **UI 표시 개선 필요**: 플래너에서 가져온 항목임을 더 명확히 표시

위 개선 방향을 따라 단계적으로 구현하면 사용자 경험이 크게 개선될 것입니다.

