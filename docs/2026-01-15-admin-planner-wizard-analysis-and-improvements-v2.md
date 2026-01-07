# 관리자 영역 플래너 생성 위저드 분석 및 개선 방향 (v2)

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: 분석 완료, 개선 방향 제시

---

## 📋 목차

1. [개요](#개요)
2. [현재 구조 분석](#현재-구조-분석)
3. [핵심 문제점](#핵심-문제점)
4. [7단계 위저드의 메타 정보 처리 로직 분석](#7단계-위저드의-메타-정보-처리-로직-분석)
5. [플래너 생성 모달 개선 방안](#플래너-생성-모달-개선-방안)
6. [플랜 생성 단계 체계화 방안](#플랜-생성-단계-체계화-방안)
7. [구현 계획](#구현-계획)

---

## 개요

### 목적

관리자 영역에서 학생 대상으로 **플래너를 먼저 생성**하고, 그 다음 **각종 플랜을 추가**하는 워크플로우를 체계화합니다. 특히 플래너 생성 시 **학생의 학습 제외일, 학원 일정 등 메타 정보를 관리자가 확인 후 선택적으로 반영**할 수 있도록 개선합니다.

### 핵심 요구사항

1. **플래너 생성이 최우선 순위**: 플랜 생성 전에 플래너를 먼저 생성해야 함
2. **플랜 생성 단계 체계화**: 플래너 생성 → 각종 플랜 추가 (컨텐츠, 단발성, 일회성 등)
3. **메타 정보 선택적 반영**:
   - 플래너 생성 시 학생의 학습 제외일, 학원 일정을 **자동 반영하지 않고**
   - 관리자가 **확인 후 선택적으로 반영**할 수 있어야 함
   - 반영 후에도 **추가 수정 가능**해야 함
4. **7단계 위저드 로직 참고**: 관리자 영역의 7단계 위저드 Step 2에서 이미 구현된 "시간 관리에서 불러오기" 로직을 참고

### 현재 상황

- **위저드 위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/`
- **주요 컴포넌트**: `AdminPlanCreationWizard7Step.tsx`
- **플래너 관리**: `PlannerManagement.tsx`, `PlannerCreationModal.tsx`
- **문제점**:
  - 플래너 생성과 플랜 생성이 분리되어 있어 우선순위가 명확하지 않음
  - 플래너 생성 시 학생의 메타 정보(제외일, 학원일정)를 확인하고 선택적으로 반영할 수 있는 기능이 없음
  - 7단계 위저드 Step 2에는 이미 구현된 로직이 있으나 플래너 생성 모달에는 없음

---

## 현재 구조 분석

### 위저드 아키텍처

```
관리자 플랜 관리 페이지
├── PlannerManagement (플래너 목록 관리)
│   └── PlannerCreationModal (플래너 생성/수정)
│       └── ❌ 메타 정보 선택적 반영 기능 없음
└── AdminPlanCreationWizard7Step (플랜 그룹 생성 위저드)
    ├── AdminWizardProvider (Context)
    └── WizardInner
        ├── Step1BasicInfo (기본 정보 - 플래너 선택 포함)
        ├── Step2TimeSettings (시간 설정)
        │   ├── ✅ "시간 관리에서 불러오기" 버튼 (학원 일정)
        │   ├── ✅ "시간 관리에서 불러오기" 버튼 (제외일)
        │   ├── ✅ AdminAcademyScheduleImportModal (선택적 반영)
        │   └── ✅ AdminExclusionImportModal (선택적 반영)
        ├── Step3SchedulePreview (스케줄 미리보기)
        ├── Step4ContentSelection (콘텐츠 선택)
        ├── Step5AllocationSettings (배분 설정)
        ├── Step6FinalReview (최종 검토)
        └── Step7GenerateResult (생성 및 결과)
```

### 데이터 흐름

#### 현재 플래너 생성 흐름

```typescript
// PlannerCreationModal.tsx
1. 플래너 기본 정보 입력 (이름, 기간, 목적)
2. 시간 설정 (학습시간, 자율학습, 점심시간)
3. 비학습 시간 블록 설정
4. 스케줄러 설정
5. 저장 → planners 테이블에 저장

❌ 문제: 학생의 기존 제외일, 학원일정을 확인하고 선택적으로 반영할 수 있는 기능이 없음
```

#### 현재 플랜 생성 흐름 (Step 2)

```typescript
// Step2TimeSettings.tsx
1. "시간 관리에서 불러오기" 버튼 클릭 (학원 일정/제외일)
2. syncTimeManagementAcademySchedulesAction / syncTimeManagementExclusionsAction 호출
3. 모달 열림 (AdminAcademyScheduleImportModal / AdminExclusionImportModal)
4. 관리자가 체크박스로 선택
5. "선택 항목 등록" 버튼으로 반영
6. 반영 후에도 수정/삭제 가능

✅ 이 로직을 플래너 생성 모달에도 동일하게 적용해야 함
```

---

## 핵심 문제점

### 1. 플래너 생성 시 메타 정보 선택적 반영 기능 부재 ⚠️

**현재 동작**:

- `PlannerCreationModal`에서 플래너를 생성할 때 학생의 기존 제외일, 학원일정을 확인하고 선택적으로 반영할 수 있는 기능이 없음
- 관리자가 수동으로 일일이 입력해야 함

**문제점**:

- 학생에게 이미 등록된 제외일/학원일정이 있어도 플래너 생성 시 참고할 수 없음
- 관리자가 일일이 입력해야 하는 번거로움
- 학생이 작성한 내용이 불분명할 수 있으므로 자동 반영은 위험함
- **관리자가 확인 후 선택적으로 반영**할 수 있어야 함

**코드 위치**: `PlannerCreationModal.tsx` (119-318줄)

```typescript
// 현재 플래너 생성 로직
const handleSubmit = async () => {
  const createInput: CreatePlannerInput = {
    studentId,
    name: formData.name.trim(),
    periodStart: formData.periodStart,
    periodEnd: formData.periodEnd,
    // ... 시간 설정만 포함
    // ❌ 학생의 기존 제외일/학원일정을 확인하고 선택적으로 반영할 수 있는 기능이 없음
  };

  result = await createPlannerAction(createInput);
};
```

### 2. 플래너 생성과 플랜 생성의 우선순위 불명확 ⚠️

**현재 동작**:

- 플래너 생성과 플랜 생성이 독립적으로 동작
- 플래너 없이도 플랜을 생성할 수 있음

**문제점**:

- 플래너를 먼저 생성해야 한다는 가이드가 없음
- 플래너 없이 플랜을 생성하면 메타 정보가 누락될 수 있음
- 워크플로우가 체계적이지 않음

### 3. 7단계 위저드의 로직이 플래너 생성 모달에 없음 ⚠️

**현재 상황**:

- 7단계 위저드 Step 2에는 이미 "시간 관리에서 불러오기" 기능이 구현되어 있음
- 플래너 생성 모달에는 동일한 기능이 없음

**문제점**:

- 코드 중복 가능성
- 일관성 없는 사용자 경험

---

## 7단계 위저드의 메타 정보 처리 로직 분석

### Step 2: 시간 설정 (`Step2TimeSettings.tsx`)

#### 학원 일정 불러오기 로직

**위치**: `Step2TimeSettings.tsx` (336-369줄)

**흐름**:

1. "시간 관리에서 불러오기" 버튼 클릭
2. `syncTimeManagementAcademySchedulesAction` 호출
3. 학생의 학원 일정 조회
4. `AdminAcademyScheduleImportModal` 모달 열림
5. 관리자가 체크박스로 선택
6. "선택 항목 등록" 버튼으로 반영

**주요 기능**:

- 학원별 그룹화 표시
- 겹치는 시간대 경고 표시
- 이미 등록된 항목은 비활성화
- 전체 선택/해제 기능

```typescript
// Step2TimeSettings.tsx
const handleOpenAcademyImportModal = useCallback(async () => {
  setIsLoadingAcademy(true);
  try {
    const result = await syncTimeManagementAcademySchedulesAction(
      null,
      studentId
    );
    if (!result.academySchedules || result.academySchedules.length === 0) {
      toast.showInfo("시간 관리에 등록된 학원 일정이 없습니다.");
      return;
    }

    const convertedSchedules: AcademySchedule[] = result.academySchedules.map(
      (s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name,
        subject: s.subject,
        travel_time: s.travel_time ?? 30,
        source: "imported" as const,
      })
    );

    setAvailableAcademySchedules(convertedSchedules);
    setIsAcademyImportModalOpen(true);
  } catch (error) {
    toast.showError("학원 일정을 불러오는 중 오류가 발생했습니다.");
  } finally {
    setIsLoadingAcademy(false);
  }
}, [studentId]);
```

#### 제외일 불러오기 로직

**위치**: `Step2TimeSettings.tsx` (374-409줄)

**흐름**:

1. "시간 관리에서 불러오기" 버튼 클릭
2. `syncTimeManagementExclusionsAction` 호출 (기간 필터링)
3. 학생의 제외일 조회
4. `AdminExclusionImportModal` 모달 열림
5. 관리자가 체크박스로 선택
6. "선택 항목 등록" 버튼으로 반영

**주요 기능**:

- 플랜 기간 내 제외일만 필터링
- 날짜별 정렬
- 이미 등록된 항목은 비활성화
- 전체 선택/해제 기능

```typescript
// Step2TimeSettings.tsx
const handleOpenExclusionImportModal = useCallback(async () => {
  if (!periodStart || !periodEnd) {
    toast.showError("학습 기간을 먼저 설정해주세요.");
    return;
  }

  setIsLoadingExclusion(true);
  try {
    const result = await syncTimeManagementExclusionsAction(
      null,
      periodStart,
      periodEnd,
      studentId
    );
    if (!result.exclusions || result.exclusions.length === 0) {
      toast.showInfo("해당 기간 내 등록된 제외일이 없습니다.");
      return;
    }

    const convertedExclusions: ExclusionSchedule[] = result.exclusions.map(
      (e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: mapExclusionType(e.exclusion_type),
        reason: e.reason,
        source: "imported" as const,
      })
    );

    setAvailableExclusions(convertedExclusions);
    setIsExclusionImportModalOpen(true);
  } catch (error) {
    toast.showError("제외일을 불러오는 중 오류가 발생했습니다.");
  } finally {
    setIsLoadingExclusion(false);
  }
}, [studentId, periodStart, periodEnd]);
```

### Import 모달 컴포넌트

#### AdminAcademyScheduleImportModal

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/modals/AdminAcademyScheduleImportModal.tsx`

**주요 기능**:

- 학원별 그룹화 표시
- 요일별 일정 목록
- 겹치는 시간대 경고
- 체크박스 다중 선택
- 전체 선택/해제

#### AdminExclusionImportModal

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/modals/AdminExclusionImportModal.tsx`

**주요 기능**:

- 플랜 기간 내 제외일 필터링
- 날짜별 정렬
- 제외일 유형별 색상 구분
- 체크박스 다중 선택
- 전체 선택/해제

---

## 플래너 생성 모달 개선 방안

### 목표

플래너 생성 모달에 7단계 위저드 Step 2와 동일한 "시간 관리에서 불러오기" 기능을 추가하여, 관리자가 학생의 메타 정보를 확인하고 선택적으로 반영할 수 있도록 한다.

### 구현 방안

#### 1. 플래너 생성 모달에 메타 정보 섹션 추가

**위치**: `PlannerCreationModal.tsx`

**추가할 섹션**:

- 학원 일정 섹션
- 제외일 섹션

**UI 구조**:

```typescript
// PlannerCreationModal.tsx에 추가
<section>
  <h3>학원 일정</h3>
  <div className="flex items-center justify-between">
    <label>학원 스케줄</label>
    <button
      onClick={handleOpenAcademyImportModal}
      className="inline-flex items-center gap-1 text-sm text-green-600"
    >
      <Download className="h-4 w-4" />
      시간 관리에서 불러오기
      {academyAvailableCount !== null && academyAvailableCount > 0 && (
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs">
          {academyAvailableCount}
        </span>
      )}
    </button>
  </div>
  {/* 학원 일정 목록 표시 */}
  {/* 직접 추가 버튼 */}
</section>

<section>
  <h3>제외일</h3>
  <div className="flex items-center justify-between">
    <label>제외 일정</label>
    <button
      onClick={handleOpenExclusionImportModal}
      disabled={!formData.periodStart || !formData.periodEnd}
      className="inline-flex items-center gap-1 text-sm text-green-600"
    >
      <Download className="h-4 w-4" />
      시간 관리에서 불러오기
      {exclusionAvailableCount !== null && exclusionAvailableCount > 0 && (
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs">
          {exclusionAvailableCount}
        </span>
      )}
    </button>
  </div>
  {/* 제외일 목록 표시 */}
  {/* 직접 추가 버튼 */}
</section>
```

#### 2. Import 모달 재사용

**방안**: 7단계 위저드의 Import 모달을 재사용

**장점**:

- 코드 중복 방지
- 일관된 사용자 경험
- 유지보수 용이

**구현**:

```typescript
// PlannerCreationModal.tsx
import { AdminAcademyScheduleImportModal } from "../admin-wizard/modals/AdminAcademyScheduleImportModal";
import { AdminExclusionImportModal } from "../admin-wizard/modals/AdminExclusionImportModal";
import { syncTimeManagementAcademySchedulesAction } from "@/lib/domains/plan/actions/plan-groups/academy";
import { syncTimeManagementExclusionsAction } from "@/lib/domains/plan/actions/plan-groups/exclusions";

// 상태 추가
const [isAcademyImportModalOpen, setIsAcademyImportModalOpen] = useState(false);
const [isExclusionImportModalOpen, setIsExclusionImportModalOpen] =
  useState(false);
const [availableAcademySchedules, setAvailableAcademySchedules] = useState<
  AcademySchedule[]
>([]);
const [availableExclusions, setAvailableExclusions] = useState<
  ExclusionSchedule[]
>([]);
const [academySchedules, setAcademySchedules] = useState<AcademySchedule[]>([]);
const [exclusions, setExclusions] = useState<ExclusionSchedule[]>([]);

// 불러오기 핸들러 (Step 2와 동일한 로직)
const handleOpenAcademyImportModal = async () => {
  // Step 2의 handleOpenAcademyImportModal과 동일한 로직
};

const handleOpenExclusionImportModal = async () => {
  // Step 2의 handleOpenExclusionImportModal과 동일한 로직
};

// Import 핸들러
const handleImportAcademySchedules = (selectedSchedules: AcademySchedule[]) => {
  setAcademySchedules([...academySchedules, ...selectedSchedules]);
};

const handleImportExclusions = (selectedExclusions: ExclusionSchedule[]) => {
  setExclusions([...exclusions, ...selectedExclusions]);
};
```

#### 3. 플래너 저장 시 메타 정보 포함

**위치**: `PlannerCreationModal.tsx`의 `handleSubmit`

**수정 내용**:

```typescript
const handleSubmit = async () => {
  const createInput: CreatePlannerInput = {
    studentId,
    name: formData.name.trim(),
    periodStart: formData.periodStart,
    periodEnd: formData.periodEnd,
    // ... 기존 필드

    // NEW: 관리자가 선택한 메타 정보 포함
    academySchedules:
      academySchedules.length > 0
        ? academySchedules.map((s) => ({
            dayOfWeek: s.day_of_week,
            startTime: s.start_time,
            endTime: s.end_time,
            academyName: s.academy_name,
            subject: s.subject,
            travelTime: s.travel_time,
            source: "imported" as const,
          }))
        : undefined,

    exclusions:
      exclusions.length > 0
        ? exclusions.map((e) => ({
            exclusionDate: e.exclusion_date,
            exclusionType: mapExclusionTypeToPlanner(e.exclusion_type),
            reason: e.reason,
            source: "imported" as const,
          }))
        : undefined,
  };

  result = await createPlannerAction(createInput);
};
```

---

## 플랜 생성 단계 체계화 방안

### 목표 워크플로우

```
1. 플래너 생성 (최우선)
   ├── 기본 정보 입력
   ├── 시간 설정
   ├── 메타 정보 선택적 반영 (NEW)
   │   ├── "시간 관리에서 불러오기" (학원 일정)
   │   ├── "시간 관리에서 불러오기" (제외일)
   │   └── 관리자가 확인 후 선택적으로 반영
   └── 플래너 저장

2. 각종 플랜 추가
   ├── 플랜 그룹 생성 (7단계 위저드)
   │   └── Step 2에서 이미 메타 정보 선택적 반영 기능 있음
   ├── 콘텐츠 추가 (flexible_contents)
   ├── 일회성 플랜 추가 (ad_hoc_plans)
   └── 단발성 플랜 추가
```

### 개선 방안

#### 1. 플래너 우선순위 강제

**구현 위치**: `AdminPlanManagement.tsx` (플랜 관리 페이지)

**로직**:

1. 플랜 생성 버튼 클릭 시 활성 플래너 확인
2. 활성 플래너가 없으면 플래너 생성 모달 먼저 표시
3. 플래너 생성 완료 후 플랜 생성 위저드로 이동

```typescript
// AdminPlanManagement.tsx에 추가
const handleCreatePlanGroup = () => {
  // 활성 플래너 확인
  const activePlanner = planners.find((p) => p.status === "active");

  if (!activePlanner) {
    // 플래너가 없으면 플래너 생성 모달 먼저 표시
    setShowPlannerCreationModal(true);
    setAfterPlannerCreation(() => () => {
      // 플래너 생성 완료 후 플랜 생성 위저드 열기
      setShowPlanCreationWizard(true);
    });
  } else {
    // 플래너가 있으면 바로 플랜 생성 위저드 열기
    setShowPlanCreationWizard(true);
  }
};
```

#### 2. UI/UX 개선

**플랜 관리 페이지 개선**:

```
[플래너 관리] ← 최우선
  └── [새 플래너] (활성 플래너가 없으면 강조)

[플랜 생성]
  ├── [플랜 그룹] (활성 플래너가 있어야 활성화)
  ├── [AI 생성]
  ├── [콘텐츠 추가]
  └── [일회성 추가]
```

---

## 구현 계획

### Phase 1: 플래너 생성 모달에 메타 정보 선택적 반영 기능 추가 (우선순위: 높음)

**작업 내용**:

1. `PlannerCreationModal.tsx`에 학원 일정/제외일 섹션 추가
2. "시간 관리에서 불러오기" 버튼 추가
3. Import 모달 재사용 (7단계 위저드의 모달)
4. 플래너 저장 시 메타 정보 포함

**예상 소요 시간**: 6시간

**파일**:

- `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`
- `lib/domains/admin-plan/actions/planners.ts` (필요 시 타입 수정)

### Phase 2: 플래너 우선순위 강제 (우선순위: 중간)

**작업 내용**:

1. `AdminPlanManagement.tsx`에 플래너 확인 로직 추가
2. 플래너 없으면 플래너 생성 모달 먼저 표시
3. 플래너 생성 완료 후 플랜 생성 위저드로 이동

**예상 소요 시간**: 3시간

**파일**:

- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`

### Phase 3: UI/UX 개선 (우선순위: 중간)

**작업 내용**:

1. 플랜 관리 페이지 UI 개선 (플래너 우선순위 강조)
2. 플래너 생성 모달 UI 개선 (메타 정보 섹션 추가)
3. 사용자 가이드 추가

**예상 소요 시간**: 3시간

**파일**:

- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`

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
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings.tsx` ⭐ **참고**
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/modals/AdminAcademyScheduleImportModal.tsx` ⭐ **재사용**
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/modals/AdminExclusionImportModal.tsx` ⭐ **재사용**
- `app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx` ⭐ **수정 대상**

### 관련 액션

- `lib/domains/admin-plan/actions/planners.ts` - 플래너 조회/생성 액션
- `lib/domains/plan/actions/plan-groups/academy.ts` - 학원 일정 동기화 액션 ⭐ **참고**
- `lib/domains/plan/actions/plan-groups/exclusions.ts` - 제외일 동기화 액션 ⭐ **참고**

### 관련 문서

- `docs/2026-01-15-admin-planner-wizard-analysis-and-improvements.md` - 기존 분석 문서
- `docs/2025-02-02-plan-creation-features-comprehensive-analysis.md` - 플랜 생성 기능 통합 분석

---

## 결론

관리자 영역 플래너 생성 위저드의 핵심 개선 사항:

1. **플래너 생성이 최우선 순위**: 플랜 생성 전에 플래너를 먼저 생성하도록 강제
2. **메타 정보 선택적 반영**: 플래너 생성 시 학생의 제외일/학원일정을 **자동 반영하지 않고**, 관리자가 **확인 후 선택적으로 반영**할 수 있도록 함
3. **7단계 위저드 로직 재사용**: Step 2에 이미 구현된 "시간 관리에서 불러오기" 로직과 Import 모달을 플래너 생성 모달에도 동일하게 적용
4. **반영 후 수정 가능**: 반영된 메타 정보는 추가 수정/삭제 가능

위 개선 방향을 따라 단계적으로 구현하면 사용자 경험이 크게 개선되고, 관리자가 학생의 메타 정보를 안전하게 확인하고 선택적으로 반영할 수 있게 됩니다.
