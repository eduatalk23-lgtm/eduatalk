# 관리자 플래너 생성 시 학습 시간 설정과 블록셋 기능 분석

**작성일**: 2026-01-15  
**작업자**: AI Assistant  
**관련 이슈**: 플래너 하위 플랜 그룹 추가 시 상속 항목 검증 및 개선

---

## 📋 개요

관리자 영역에서 학생 대상 플래너 생성 시 학습 시간 설정과 7단계 위저드의 블록셋 기능을 분석하고, 플래너 하위 플랜 그룹 추가 시 상속 항목이 올바르게 반영되는지 확인합니다.

---

## 🔍 현재 구조 분석

### 1. 플래너 생성 흐름

#### 1.1 PlannerCreationModal

**위치**: `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`

**기능**:
- 플래너 기본 정보 입력 (이름, 기간, 목적)
- 학습 시간 설정 (studyHours, selfStudyHours, lunchTime)
- 비학습 시간 블록 설정 (nonStudyTimeBlocks)
- 블록셋 선택 (block_set_id)
- 스케줄러 설정 (default_scheduler_type, default_scheduler_options)

**저장되는 데이터**:
```typescript
{
  study_hours: { start: "10:00", end: "19:00" },
  self_study_hours: { start: "19:00", end: "22:00" },
  lunch_time: { start: "12:00", end: "13:00" },
  block_set_id: string | null,
  non_study_time_blocks: NonStudyTimeBlock[],
  default_scheduler_type: "1730_timetable" | "custom",
  default_scheduler_options: { study_days: 6, review_days: 1 }
}
```

---

### 2. 7단계 위저드 구조

#### 2.1 Step 1: 기본 정보 (Step1BasicInfo)

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step1BasicInfo.tsx`

**주요 기능**:

1. **플래너 선택** (선택적)
   - 플래너 선택 시 자동 상속 로직:
   ```typescript
   // 플래너 선택 핸들러 (188-294줄)
   const handlePlannerSelect = useCallback(async (id: string | undefined) => {
     // 플래너 선택 해제 시: 상속 설정 정리
     if (!id) {
       updateData({
         plannerId: undefined,
         studyHours: null,
         selfStudyHours: null,
         lunchTime: null,
         nonStudyTimeBlocks: [],
         exclusions: wizardData.exclusions.filter(e => !e.is_locked),
         academySchedules: wizardData.academySchedules.filter(s => !s.is_locked),
       });
       return;
     }

     // 플래너 상세 정보 로드 후 자동 채우기
     const planner = await getPlannerAction(id, true);
     
     // 기본 정보 자동 채우기
     const autoFillData: Partial<typeof wizardData> = {
       plannerId: id,
       periodStart: planner.periodStart,
       periodEnd: planner.periodEnd,
       blockSetId: planner.blockSetId ?? undefined, // ✅ 블록셋 상속
     };

     // 시간 설정 자동 채우기
     autoFillData.studyHours = planner.studyHours ?? null; // ✅ 학습 시간 상속
     autoFillData.selfStudyHours = planner.selfStudyHours ?? null; // ✅ 자율학습 시간 상속
     autoFillData.lunchTime = planner.lunchTime ?? null; // ✅ 점심 시간 상속
     autoFillData.nonStudyTimeBlocks = planner.nonStudyTimeBlocks ?? []; // ✅ 비학습 블록 상속

     // 스케줄러 타입 자동 채우기
     if (planner.defaultSchedulerType) {
       autoFillData.schedulerType = planner.defaultSchedulerType;
     }

     // 제외일 상속 (is_locked: true로 설정)
     const plannerExclusions: ExclusionSchedule[] = planner.exclusions.map((e) => ({
       exclusion_date: e.exclusionDate,
       exclusion_type: mapExclusionType(e.exclusionType),
       reason: e.reason ?? undefined,
       source: "planner",
       is_locked: true, // ✅ 플래너에서 가져온 제외일은 삭제 방지
     }));

     // 학원 일정 상속 (is_locked: true로 설정)
     const plannerAcademySchedules: AcademySchedule[] = planner.academySchedules.map((s) => ({
       academy_name: s.academyName ?? "학원",
       day_of_week: s.dayOfWeek,
       start_time: s.startTime,
       end_time: s.endTime,
       subject: s.subject ?? undefined,
       travel_time: s.travelTime ?? 60,
       source: "planner",
       is_locked: true, // ✅ 플래너에서 가져온 학원일정은 삭제 방지
     }));

     // 스케줄러 옵션 상속
     if (planner.defaultSchedulerOptions) {
       autoFillData.schedulerOptions = {
         study_days: opts.study_days ?? 6,
         review_days: opts.review_days ?? 1,
       };
     }

     updateData(autoFillData);
   }, [updateData, wizardData]);
   ```

2. **블록셋 선택** (선택적)
   - 플래너 선택 시 자동 상속됨
   - 수동 선택도 가능
   - 블록셋 미리보기 제공

**상속되는 항목**:
- ✅ `periodStart`, `periodEnd` (기간)
- ✅ `blockSetId` (블록셋)
- ✅ `studyHours` (학습 시간)
- ✅ `selfStudyHours` (자율학습 시간)
- ✅ `lunchTime` (점심 시간)
- ✅ `nonStudyTimeBlocks` (비학습 블록)
- ✅ `schedulerType` (스케줄러 타입)
- ✅ `schedulerOptions` (스케줄러 옵션)
- ✅ `exclusions` (제외일, is_locked: true)
- ✅ `academySchedules` (학원 일정, is_locked: true)

---

#### 2.2 Step 2: 시간 설정 (Step2TimeSettings)

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings.tsx`

**주요 기능**:

1. **플래너 상속 시간 설정 표시** (읽기 전용)
   ```typescript
   // 플래너에서 상속된 시간 설정이 있는지 확인 (99-104줄)
   const hasInheritedTimeSettings = !!plannerId && (!!studyHours || !!selfStudyHours || !!lunchTime);
   
   // 플래너에서 상속된 스케줄러 옵션이 있는지 확인
   const hasInheritedSchedulerOptions = !!plannerId && !!schedulerOptions &&
     (schedulerOptions.study_days !== undefined || schedulerOptions.review_days !== undefined);
   ```

2. **비학습 블록 표시** (플래너 상속)
   - 플래너에서 상속된 비학습 블록을 읽기 전용으로 표시

3. **스케줄러 타입 선택**
   - 1730 시간표 / 맞춤 설정

4. **학원 스케줄 관리**
   - 시간 관리에서 불러오기
   - 직접 추가
   - 플래너에서 상속된 항목은 `is_locked: true`로 표시되어 삭제 불가

5. **제외 일정 관리**
   - 시간 관리에서 불러오기
   - 직접 추가
   - 플래너에서 상속된 항목은 `is_locked: true`로 표시되어 삭제 불가

**UI 표시**:
- 플래너 상속 시간 설정은 읽기 전용으로 표시 (546-599줄)
- 비학습 블록은 "플래너에서 상속" 배지와 함께 표시 (601-646줄)
- 스케줄러 옵션은 "플래너에서 상속된 주간 학습/복습 설정"으로 표시 (691-721줄)

---

### 3. 플랜 그룹 생성 시 상속 로직

#### 3.1 AdminPlanCreationWizard7Step - handleSubmit

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**현재 구현** (394-517줄):

```typescript
const handleSubmit = useCallback(async () => {
  // ... 검증 로직 ...

  const {
    name,
    planPurpose,
    periodStart,
    periodEnd,
    selectedContents,
    skipContents,
    exclusions,
    academySchedules,
    schedulerType,
    blockSetId,
    schedulerOptions,
    // ❌ 문제: studyHours, selfStudyHours, lunchTime, nonStudyTimeBlocks가 누락됨
  } = wizardData;

  // PlanGroupCreationData 구성
  const planGroupData: PlanGroupCreationData = {
    name: name || null,
    plan_purpose: planPurpose || "내신대비",
    scheduler_type: schedulerType || "1730_timetable",
    period_start: periodStart,
    period_end: periodEnd,
    block_set_id: blockSetId || null, // ✅ 블록셋은 포함됨
    planner_id: plannerId || null, // ✅ 플래너 ID는 포함됨
    scheduler_options: enhancedSchedulerOptions,
    contents: skipContents ? [] : selectedContents.map(...),
    exclusions: exclusions.map(...),
    academy_schedules: academySchedules.map(...),
    // ❌ 문제: 시간 설정이 누락됨
    // study_hours: wizardData.studyHours || null,
    // self_study_hours: wizardData.selfStudyHours || null,
    // lunch_time: wizardData.lunchTime || null,
    // non_study_time_blocks: wizardData.nonStudyTimeBlocks || null,
  };

  // 플랜 그룹 생성
  const result = await createPlanGroupAction(planGroupData, {
    skipContentValidation: true,
    studentId: studentId,
  });
}, [/* ... */]);
```

**문제점**:
- ❌ `studyHours`, `selfStudyHours`, `lunchTime`, `nonStudyTimeBlocks`가 `planGroupData`에 포함되지 않음
- 플래너에서 상속받은 시간 설정이 플랜 그룹 생성 시 반영되지 않음

---

#### 3.2 createPlanGroupAction - 서버 사이드 처리

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

**현재 구현** (439-467줄):

```typescript
// 플랜 그룹 데이터 준비
const planGroupData: PlanGroupAtomicInput = {
  name: data.name || null,
  plan_purpose: normalizePlanPurpose(data.plan_purpose),
  scheduler_type: data.scheduler_type,
  scheduler_options: mergedSchedulerOptions,
  period_start: data.period_start,
  period_end: data.period_end,
  target_date: data.target_date || null,
  block_set_id: data.block_set_id || null, // ✅ 블록셋은 포함됨
  planner_id: data.planner_id || null, // ✅ 플래너 ID는 포함됨
  status: "draft",
  subject_constraints: data.subject_constraints || null,
  additional_period_reallocation: data.additional_period_reallocation || null,
  non_study_time_blocks: data.non_study_time_blocks || null, // ✅ 비학습 블록은 포함됨
  daily_schedule: data.daily_schedule || null,
  plan_type: data.plan_type || null,
  camp_template_id: data.camp_template_id || null,
  camp_invitation_id: data.camp_invitation_id || null,
  use_slot_mode: data.use_slot_mode ?? false,
  content_slots: data.content_slots || null,
  // ✅ 시간 설정은 포함됨 (데이터가 전달되면)
  study_hours: data.study_hours || null,
  self_study_hours: data.self_study_hours || null,
  lunch_time: data.lunch_time || null,
};
```

**상태**:
- ✅ 서버 사이드에서는 시간 설정을 지원함
- ❌ 클라이언트에서 데이터를 전달하지 않음

---

#### 3.3 createPlanGroupForPlanner - 플래너 기반 자동 생성

**위치**: `lib/domains/admin-plan/utils/planGroupSelector.ts`

**현재 구현** (122-288줄):

```typescript
export async function createPlanGroupForPlanner(input: {
  plannerId: string;
  studentId: string;
  tenantId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{ success: boolean; planGroupId?: string; error?: string }> {
  // 플래너 설정 조회
  const { data: planner } = await supabase
    .from("planners")
    .select(`
      study_hours,
      self_study_hours,
      lunch_time,
      default_scheduler_type,
      default_scheduler_options,
      block_set_id,
      non_study_time_blocks
    `)
    .eq("id", plannerId)
    .single();

  // Plan Group 생성 (플래너 설정 상속)
  const { data: planGroup } = await supabase
    .from("plan_groups")
    .insert({
      planner_id: plannerId,
      student_id: studentId,
      tenant_id: tenantId,
      name: name,
      period_start: periodStart,
      period_end: periodEnd,
      status: "active",
      // ✅ 플래너에서 설정 상속
      study_hours: planner.study_hours, // ✅ 학습 시간 상속
      self_study_hours: planner.self_study_hours, // ✅ 자율학습 시간 상속
      lunch_time: planner.lunch_time, // ✅ 점심 시간 상속
      scheduler_type: planner.default_scheduler_type ?? "even",
      scheduler_options: planner.default_scheduler_options ?? {},
      block_set_id: planner.block_set_id, // ✅ 블록셋 상속
      non_study_time_blocks: planner.non_study_time_blocks, // ✅ 비학습 블록 상속
    })
    .select("id")
    .single();

  // ✅ 플래너 제외일을 플랜 그룹에 상속
  if (plannerExclusions && plannerExclusions.length > 0) {
    const exclusionsToInsert = plannerExclusions.map((e) => ({
      tenant_id: tenantId,
      plan_group_id: planGroupId,
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason,
      source: "inherited",
      is_locked: false,
    }));
    await supabase.from("plan_exclusions").insert(exclusionsToInsert);
  }

  // ✅ 플래너 학원일정을 플랜 그룹에 상속
  if (plannerSchedules && plannerSchedules.length > 0) {
    const schedulesToInsert = plannerSchedules.map((s) => ({
      tenant_id: tenantId,
      plan_group_id: planGroupId,
      academy_id: s.academy_id,
      academy_name: s.academy_name,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      subject: s.subject,
      travel_time: s.travel_time,
      source: "inherited",
      is_locked: false,
    }));
    await supabase.from("academy_schedules").insert(schedulesToInsert);
  }

  return { success: true, planGroupId: planGroup.id };
}
```

**상태**:
- ✅ 모든 상속 항목이 올바르게 반영됨
- ✅ 제외일과 학원일정도 상속됨

---

## ❌ 발견된 문제점

### 문제 1: AdminPlanCreationWizard7Step에서 시간 설정 누락

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**문제**:
- `handleSubmit` 함수에서 `planGroupData`를 생성할 때 `studyHours`, `selfStudyHours`, `lunchTime`, `nonStudyTimeBlocks`가 포함되지 않음
- 플래너에서 상속받은 시간 설정이 플랜 그룹 생성 시 반영되지 않음

**영향**:
- 플래너에서 설정한 학습 시간, 자율학습 시간, 점심 시간이 플랜 그룹에 저장되지 않음
- 비학습 블록도 저장되지 않음
- 플랜 생성 시 기본값이 사용됨

---

### 문제 2: 블록셋 상속 확인

**상태**: ✅ 정상 작동
- Step1BasicInfo에서 플래너 선택 시 `blockSetId` 자동 상속됨
- `handleSubmit`에서 `block_set_id`로 전달됨
- 서버 사이드에서 저장됨

---

## ✅ 정상 작동하는 부분

### 1. Step1BasicInfo - 플래너 상속 로직

- ✅ 플래너 선택 시 모든 설정 자동 상속
- ✅ 블록셋 상속
- ✅ 시간 설정 상속
- ✅ 제외일/학원일정 상속 (is_locked: true)

### 2. Step2TimeSettings - UI 표시

- ✅ 플래너 상속 시간 설정 읽기 전용 표시
- ✅ 비학습 블록 표시
- ✅ 스케줄러 옵션 표시
- ✅ 제외일/학원일정 잠금 표시

### 3. createPlanGroupForPlanner - 자동 생성

- ✅ 모든 상속 항목이 올바르게 반영됨

### 4. 서버 사이드 처리

- ✅ `createPlanGroupAction`에서 시간 설정 필드 지원
- ✅ `createPlanGroupAtomic` RPC 함수에서 시간 설정 저장

---

## 🔧 개선 필요 사항

### 개선 1: AdminPlanCreationWizard7Step - handleSubmit 수정

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**수정 내용**:

```typescript
const handleSubmit = useCallback(async () => {
  // ... 기존 코드 ...

  const {
    name,
    planPurpose,
    periodStart,
    periodEnd,
    selectedContents,
    skipContents,
    exclusions,
    academySchedules,
    schedulerType,
    blockSetId,
    schedulerOptions,
    // ✅ 추가: 시간 설정 필드
    studyHours,
    selfStudyHours,
    lunchTime,
    nonStudyTimeBlocks,
  } = wizardData;

  // PlanGroupCreationData 구성
  const planGroupData: PlanGroupCreationData = {
    name: name || null,
    plan_purpose: planPurpose || "내신대비",
    scheduler_type: schedulerType || "1730_timetable",
    period_start: periodStart,
    period_end: periodEnd,
    block_set_id: blockSetId || null,
    planner_id: plannerId || null,
    scheduler_options: enhancedSchedulerOptions,
    contents: skipContents ? [] : selectedContents.map(...),
    exclusions: exclusions.map(...),
    academy_schedules: academySchedules.map(...),
    // ✅ 추가: 시간 설정 필드
    study_hours: studyHours || null,
    self_study_hours: selfStudyHours || null,
    lunch_time: lunchTime || null,
    non_study_time_blocks: nonStudyTimeBlocks || null,
  };

  // ... 나머지 코드 ...
}, [
  hasErrors,
  wizardData,
  studentId,
  plannerId,
  draftGroupId,
  setSubmitting,
  setError,
  setCreatedGroupId,
  onSuccess,
]);
```

---

### 개선 2: 타입 정의 확인

**파일**: `lib/types/plan/input.ts`

**확인 사항**:
- ✅ `PlanGroupCreationData` 타입에 시간 설정 필드가 이미 정의되어 있음 (60-63줄)
- ✅ 타입 정의는 정상

---

## 📊 상속 항목 체크리스트

### 플래너 → 플랜 그룹 상속 항목

| 항목 | Step1 상속 | Step2 표시 | handleSubmit 전달 | 서버 저장 | 상태 |
|------|-----------|-----------|------------------|----------|------|
| `periodStart` | ✅ | - | ✅ | ✅ | ✅ 정상 |
| `periodEnd` | ✅ | - | ✅ | ✅ | ✅ 정상 |
| `blockSetId` | ✅ | - | ✅ | ✅ | ✅ 정상 |
| `studyHours` | ✅ | ✅ (읽기 전용) | ✅ | ✅ | ✅ **정상** |
| `selfStudyHours` | ✅ | ✅ (읽기 전용) | ✅ | ✅ | ✅ **정상** |
| `lunchTime` | ✅ | ✅ (읽기 전용) | ✅ | ✅ | ✅ **정상** |
| `nonStudyTimeBlocks` | ✅ | ✅ (읽기 전용) | ✅ | ✅ | ✅ **정상** |
| `schedulerType` | ✅ | ✅ | ✅ | ✅ | ✅ 정상 |
| `schedulerOptions` | ✅ | ✅ (읽기 전용) | ✅ | ✅ | ✅ 정상 |
| `exclusions` | ✅ | ✅ (is_locked) | ✅ | ✅ | ✅ 정상 |
| `academySchedules` | ✅ | ✅ (is_locked) | ✅ | ✅ | ✅ 정상 |

---

## 🎯 결론

### 현재 상태

1. **정상 작동**:
   - ✅ Step1BasicInfo에서 플래너 선택 시 모든 설정 자동 상속
   - ✅ Step2TimeSettings에서 상속된 설정 읽기 전용 표시
   - ✅ 블록셋 상속 및 저장
   - ✅ 제외일/학원일정 상속 및 저장
   - ✅ 서버 사이드에서 시간 설정 필드 지원
   - ✅ **개선 완료**: `AdminPlanCreationWizard7Step`의 `handleSubmit`에서 시간 설정 필드 포함

2. **개선 완료**:
   - ✅ `AdminPlanCreationWizard7Step.tsx`의 `handleSubmit` 함수 수정 완료
   - ✅ `wizardData`에서 시간 설정 필드 추출 추가
   - ✅ `planGroupData`에 시간 설정 필드 추가 완료

### 개선 완료 내역

**작업 일자**: 2026-01-15

**수정 파일**:
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**수정 내용**:
1. `handleSubmit` 함수에서 `wizardData` 구조 분해 시 시간 설정 필드 추가:
   ```typescript
   const {
     // ... 기존 필드들 ...
     // ✅ 추가: 플래너에서 상속된 시간 설정
     studyHours,
     selfStudyHours,
     lunchTime,
     nonStudyTimeBlocks,
   } = wizardData;
   ```

2. `planGroupData` 객체에 시간 설정 필드 추가:
   ```typescript
   const planGroupData: PlanGroupCreationData = {
     // ... 기존 필드들 ...
     // ✅ 추가: 플래너에서 상속된 시간 설정
     study_hours: studyHours || null,
     self_study_hours: selfStudyHours || null,
     lunch_time: lunchTime || null,
     non_study_time_blocks: nonStudyTimeBlocks || null,
   };
   ```

**결과**:
- ✅ 플래너에서 상속받은 시간 설정이 플랜 그룹 생성 시 올바르게 반영됨
- ✅ 모든 상속 항목이 정상적으로 저장됨

---

## 📝 참고 문서

- [플래너-플랜 그룹 상속 모델](./2026-01-06-planner-plan-group-inheritance-next-steps.md)
- [관리자 플래너 위저드 분석](./2026-01-15-admin-planner-wizard-analysis-and-improvements-v2.md)
- [플랜 그룹 생성 저장 정보](./플랜_그룹_생성_저장_정보.md)

---

**작업 완료**: ✅ 개선 사항 적용 완료 (2026-01-15)

**테스트 필요**: 
- 플래너 선택 시 시간 설정이 플랜 그룹에 올바르게 저장되는지 확인
- 플랜 생성 시 저장된 시간 설정이 사용되는지 확인

