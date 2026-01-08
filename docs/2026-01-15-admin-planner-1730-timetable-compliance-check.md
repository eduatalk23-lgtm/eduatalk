# 관리자 영역 1730 Timetable 방법론 준수 점검 및 통합 상태 문서

**작성일**: 2026-01-15  
**목적**: 관리자 영역에서 학생 대상 플래너 생성 및 플랜 관리(플랜 추가) 기능이 1730 timetable 방법론에 부합하는지 점검하고, 독(Dock)과 시간슬롯, 타임라인 스케줄러 통합 상태를 문서화

---

## 📋 목차

1. [1730 Timetable 방법론 요구사항](#1730-timetable-방법론-요구사항)
2. [관리자 플래너 생성 기능 점검](#관리자-플래너-생성-기능-점검)
3. [관리자 플랜 추가 기능 점검](#관리자-플랜-추가-기능-점검)
4. [독(Dock)과 시간슬롯, 타임라인 스케줄러 통합 상태](#독dock과-시간슬롯-타임라인-스케줄러-통합-상태)
5. [개선 사항 및 권장 사항](#개선-사항-및-권장-사항)

---

## 1730 Timetable 방법론 요구사항

### 필수 입력 항목

1730 timetable 방법론에 따르면 다음 항목들이 필수입니다:

#### 1. 기본 정보
- ✅ 플랜 이름 (`name`)
- ✅ 플랜 목적 (`plan_purpose`)
- ✅ 스케줄러 유형 (`scheduler_type`) - "1730_timetable"
- ✅ 기간 설정 (`period_start`, `period_end`)
- ✅ 블록 세트 선택 (`block_set_id`)
- ✅ 1730 Timetable 옵션:
  - ✅ 학습일 수 (`study_days`) - 슬라이더 (1-7)
  - ✅ 복습일 수 (`review_days`) - 슬라이더 (0-3)
  - ✅ 복습 범위 (`review_scope`) - 드롭다운 ("full" | "partial")

#### 2. 전략과목/취약과목 정보 ✅ **구현됨** [2026-01-15 업데이트]
```typescript
{
  content_type: "book" | "lecture";
  content_id: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목인 경우: 2, 3, 4
}
```

**구현 상태**:
- ✅ Step 4에서 콘텐츠별 과목 유형 선택 가능
- ✅ 전략과목 선택 시 주당 배정 일수(2, 3, 4일) 설정 가능
- ✅ `scheduler_options.content_allocations`에 저장
- 🔄 스케줄러 통합 대기 중 (보정 계수 적용)

**영향**:
- 소요시간 계산 시 과목별 보정 계수 적용 준비 완료
  - 취약과목: ×1.2
  - 전략과목: ×1.0~1.1
- 과목 배정 방식 결정 가능

#### 3. 학생 수준 정보 ✅ **구현됨**
```typescript
{
  student_level: "high" | "medium" | "low";
}
```

**영향**:
- 소요시간 계산 시 학생 수준 보정 계수 적용
  - 상위 수준 (high): 0.8~0.9
  - 중위 수준 (medium): 1.0
  - 하위 수준 (low): 1.1~1.3

---

## 관리자 플래너 생성 기능 점검

### 현재 구현 상태

#### 1. 플래너 생성 (`_createPlanner`)

**위치**: `lib/domains/admin-plan/actions/planners.ts`

**구현 내용**:
```typescript
default_scheduler_type: input.defaultSchedulerType || "1730_timetable",
default_scheduler_options: input.defaultSchedulerOptions || {
  study_days: 6,
  review_days: 1,
},
```

**점검 결과**:
- ✅ 스케줄러 유형 기본값: "1730_timetable"
- ✅ 학습일/복습일 주기 설정 가능
- ⚠️ 전략과목/취약과목 정보 저장 필드 없음
- ⚠️ 학생 수준 정보 저장 필드 없음 (플래너 레벨이 아닌 플랜 그룹 레벨에서 관리)

#### 2. 플랜 그룹 생성 위저드 (`AdminPlanCreationWizard7Step`)

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**Step별 점검**:

##### Step 1: 기본 정보 ✅
- 플랜 이름, 목적, 기간 설정
- 스케줄러 유형 선택
- 블록 세트 선택

##### Step 2: 시간 설정 ✅
- 학습 시간, 자율학습 시간, 점심 시간
- 학원 일정, 제외일 설정

##### Step 3: 스케줄 미리보기 ✅
- Step 2.5 스케줄 결과 표시
- 타임라인 시각화

##### Step 4: 콘텐츠 선택 ✅ **[2026-01-15 업데이트]**
- 학생 콘텐츠 선택
- 콘텐츠 범위 설정
- ✅ **과목 유형 선택**: 전략과목/취약과목 선택 UI 존재
- ✅ **주당 배정 일수 선택**: 전략과목 선택 시 주당 배정 일수(2, 3, 4일) 설정 UI 추가 (Phase 1 완료)

##### Step 5: 배분 설정 ⚠️ **부분 구현**
**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step5AllocationSettings.tsx`

**구현 내용**:
```typescript
const studentLevel = schedulerOptions.student_level || "medium";
// 학생 수준 선택 UI 존재
```

**점검 결과**:
- ✅ 학생 수준 정보 입력 가능 (`student_level`)
- ⚠️ 전략과목/취약과목 정보 입력 UI 없음
- ⚠️ 과목별 주당 배정 일수 설정 불가

##### Step 6: 최종 검토 ✅
- 학습일/복습일 주기 조정
- 교과 제약 조건
- 추가 기간 재배치

##### Step 7: 생성 및 결과 ✅
- 플랜 생성 및 결과 표시

### 문제점 요약 [2026-01-15 업데이트]

#### ✅ Phase 1 완료: 필수 입력 항목 추가

1. **전략과목/취약과목 정보** ✅ **완료**
   - ~~현재 상태: Step 5에서 과목별 유형 설정 불가~~ → **Step 4에 이미 구현되어 있음을 확인**
   - ✅ Step 4에서 각 콘텐츠에 대해 "전략과목" 또는 "취약과목" 선택 가능
   - ✅ 위치: `Step4ContentSelection.tsx:49-53, 463-490`
   - 🔄 다음 단계: 스케줄러에서 과목별 보정 계수 적용

2. **과목별 주당 배정 일수** ✅ **완료**
   - ~~현재 상태: 전략과목의 주당 배정 일수 설정 불가~~
   - ✅ **구현 완료 (2026-01-15)**: Step 4에 주당 배정 일수(2, 3, 4일, 미지정) 선택 UI 추가
   - ✅ 위치: `Step4ContentSelection.tsx:518-545`
   - ✅ 데이터 흐름: UI → `wizardData.selectedContents[].weeklyDays` → `scheduler_options.content_allocations`
   - 🔄 다음 단계: 스케줄러에서 주당 배정 일수 반영

#### ⚠️ 남은 개선 사항

#### ✅ 잘 구현된 부분

1. **학생 수준 정보**
   - Step 5에서 학생 수준 선택 가능
   - `schedulerOptions.student_level`에 저장

2. **학습일/복습일 주기**
   - 플래너 생성 시 기본값 설정
   - Step 6에서 조정 가능

3. **스케줄러 유형**
   - 기본값: "1730_timetable"
   - 플래너 생성 시 자동 설정

---

## 관리자 플랜 추가 기능 점검

### 현재 구현 상태

#### 1. 콘텐츠 추가 모달 (`AddContentModal`, `AddContentWizard`)

**위치**: 
- `app/(admin)/admin/students/[id]/plans/_components/AddContentModal.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/add-content-wizard/AddContentWizard.tsx`

**배치 모드**:
- `today`: 오늘 날짜에 단일 플랜 추가 (Daily Dock)
- `weekly`: 주간 Dock에 단일 플랜 추가 (Weekly Dock)
- `period`: 기간에 걸쳐 배치 (스케줄러 활용)

#### 2. 스케줄러 기반 플랜 생성 (`createPlanFromContentWithScheduler`)

**위치**: `lib/domains/admin-plan/actions/createPlanFromContent.ts`

**구현 내용**:
```typescript
// period 모드에서만 스케줄러 활용
if (input.distributionMode !== 'period' || !input.periodEndDate) {
  return createPlanFromContent(input);
}

// 1. 플래너 기반 스케줄 생성
const scheduleResult = await generateScheduleForPlanner(
  input.plannerId,
  input.targetDate,
  input.periodEndDate
);

// 2. 기존 플랜 조회 (시간 충돌 방지)
const existingPlans = await getExistingPlansForStudent(
  input.studentId,
  input.targetDate,
  input.periodEndDate
);

// 3. 기존 타임라인 반영
const adjustedDateTimeSlots = adjustDateTimeSlotsWithExistingPlans(
  scheduleResult.dateTimeSlots,
  existingPlansByDate
);

// 4. 스케줄러로 플랜 생성
const scheduledPlans = await generatePlansFromGroup(
  group,
  [planContent],
  exclusions,
  academySchedules,
  blocks,
  undefined, // contentSubjects
  undefined, // riskIndexMap
  adjustedDateAvailableTimeRanges,
  adjustedDateTimeSlots, // 기존 플랜을 고려한 타임라인
  undefined, // contentDurationMap
  undefined // contentChapterMap
);
```

**점검 결과**:
- ✅ period 모드에서 스케줄러 활용
- ✅ 플래너의 시간 설정 활용 (학습시간, 자율학습시간 등)
- ✅ 블록 세트 정보 활용
- ✅ 학원일정 및 제외일 고려
- ✅ 기존 타임라인 고려 (시간 충돌 방지)
- ⚠️ today/weekly 모드에서는 스케줄러 미활용 (단순 배치)

#### 3. 기존 타임라인 고려 기능

**위치**: 
- `lib/domains/admin-plan/actions/planCreation/existingPlansQuery.ts`
- `lib/domains/admin-plan/actions/planCreation/timelineAdjustment.ts`

**구현 내용**:
- `getExistingPlansForStudent`: 학생의 기존 플랜 시간 정보 조회
- `adjustDateTimeSlotsWithExistingPlans`: 기존 플랜 시간을 dateTimeSlots에서 제외
- `adjustDateAvailableTimeRangesWithExistingPlans`: 기존 플랜 시간을 dateAvailableTimeRanges에서 제외

**점검 결과**:
- ✅ 기존 플랜 조회 기능 구현됨
- ✅ 타임라인 조정 기능 구현됨
- ✅ period 모드에서만 사용됨

### 문제점 요약 [2026-01-08 업데이트]

#### ✅ today 모드 스케줄러 통합 완료 (Phase 2)

**현재 상태**:
- `today` 모드: ✅ 스케줄러 옵션 추가 (useScheduler 체크박스)
  - 체크 시: Best Fit 알고리즘으로 기존 플랜 고려하여 시간 배정
  - 미체크 시: 기존 동작 유지 (시간 미배정)
- `weekly` 모드: 유연성 유지를 위해 스케줄러 미적용 (의도적 결정)
- `period` 모드: ✅ 스케줄러 활용 (Best Fit 알고리즘)

**해결됨**:
- ~~today 모드에서 플래너의 시간 설정 미활용~~ → ✅ 스케줄러 통합
- ~~기존 타임라인 미고려 (시간 충돌 가능)~~ → ✅ 기존 플랜 충돌 방지
- ~~Best Fit 알고리즘 미적용~~ → ✅ singleDayScheduler.ts 구현

#### ✅ 잘 구현된 부분

1. **period 모드 스케줄러 활용**
   - 플래너 기반 스케줄 생성
   - 기존 타임라인 고려
   - Best Fit 알고리즘 적용

2. **기존 타임라인 고려**
   - 기존 플랜 조회
   - 타임라인 조정
   - 시간 충돌 방지

---

## 독(Dock)과 시간슬롯, 타임라인 스케줄러 통합 상태

### Dock 컴포넌트 구조

#### 1. Dock 컴포넌트 종류

**위치**: `app/(admin)/admin/students/[id]/plans/_components/`

1. **UnfinishedDock** (`UnfinishedDock.tsx`)
   - 미완료 플랜 표시
   - React Query로 데이터 조회 (`useUnfinishedDockQuery`)

2. **DailyDock** (`DailyDock.tsx`)
   - 오늘 할 일 플랜 표시
   - React Query로 데이터 조회 (`useDailyDockQuery`)

3. **WeeklyDock** (`WeeklyDock.tsx`)
   - 주간 유동 플랜 표시
   - React Query로 데이터 조회 (`useWeeklyDockQuery`)

#### 2. Dock 데이터 조회

**위치**: `lib/hooks/useAdminDockQueries.ts`

**구현 내용**:
- `useUnfinishedDockQuery`: 미완료 플랜 조회
- `useDailyDockQuery`: 오늘 할 일 플랜 조회
- `useWeeklyDockQuery`: 주간 유동 플랜 조회

**점검 결과**:
- ✅ Dock별 React Query 훅 구현됨
- ✅ 캐시 무효화 기능 (`useInvalidateAllDockQueries`)
- ⚠️ 타임라인 정보와 직접 연계되지 않음

### 타임라인 컴포넌트 구조

#### 1. 타임라인 유틸리티

**위치**: `app/(student)/plan/calendar/_utils/timelineUtils.ts`

**구현 내용**:
- `buildTimelineSlots`: 날짜별 타임라인 슬롯 생성
- `getTimelineSlots`: 타임라인 슬롯 조회 및 필터링

**점검 결과**:
- ✅ 타임라인 슬롯 생성 기능 구현됨
- ✅ 학생 영역에서 사용 중
- ⚠️ 관리자 영역에서 직접 사용되지 않음

#### 2. 타임라인 시각화 컴포넌트

**위치**: 
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/_components/WeeklyAvailabilityTimeline.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/_components/DayTimelineBar.tsx`

**구현 내용**:
- 주간 가용시간 타임라인 표시
- 일별 타임라인 바 표시

**점검 결과**:
- ✅ 위저드 Step 3에서 타임라인 시각화
- ⚠️ 플랜 관리 페이지에서 타임라인 시각화 없음

### 스케줄러 통합 상태

#### 1. 스케줄 생성 (`generateScheduleForPlanner`)

**위치**: `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts`

**구현 내용**:
- 플래너 기반 스케줄 생성
- `dateTimeSlots`, `dateAvailableTimeRanges` 생성

**점검 결과**:
- ✅ 플래너 기반 스케줄 생성 기능 구현됨
- ✅ period 모드에서 사용됨

#### 2. 스케줄러 엔진 (`SchedulerEngine`)

**위치**: `lib/scheduler/SchedulerEngine.ts`

**구현 내용**:
- Best Fit 알고리즘
- 타임라인 기반 플랜 배정

**점검 결과**:
- ✅ Best Fit 알고리즘 구현됨
- ✅ 타임라인 기반 배정 지원
- ⚠️ 기존 플랜 정보를 Context에 포함하지 않음 (별도 조정 필요)

### 통합 상태 요약

#### ✅ 잘 통합된 부분

1. **period 모드 플랜 추가**
   - 스케줄러 활용
   - 기존 타임라인 고려
   - Best Fit 알고리즘 적용

2. **Dock 컴포넌트**
   - React Query로 데이터 조회
   - 캐시 무효화 지원

3. **타임라인 조정**
   - 기존 플랜 시간 제외
   - 빈 시간대 추출

#### ⚠️ 개선이 필요한 부분

1. **Dock과 타임라인 연계**
   - Dock에서 타임라인 정보 표시 없음
   - 타임라인 기반 플랜 배치 시각화 없음

2. **today/weekly 모드**
   - 스케줄러 미활용
   - 타임라인 미고려

3. **관리자 플랜 관리 페이지**
   - 타임라인 시각화 없음
   - Dock과 타임라인 통합 없음

---

## 개선 사항 및 권장 사항

### 우선순위 1: 필수 입력 항목 추가

#### 1. 전략과목/취약과목 정보 입력 UI 추가

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step5AllocationSettings.tsx`

**구현 방안**:
1. Step 4 또는 Step 5에 과목별 유형 설정 섹션 추가
2. 각 콘텐츠에 대해 "전략과목" 또는 "취약과목" 선택
3. 전략과목인 경우 주당 배정 일수 선택 (2, 3, 4)

**데이터 저장**:
```typescript
// scheduler_options에 추가
scheduler_options: {
  study_days: 6,
  review_days: 1,
  student_level: "medium",
  subject_allocations: [
    {
      subject_id: string,
      subject_name: string,
      subject_type: "strategy" | "weakness",
      weekly_days?: number, // 전략과목인 경우
    }
  ]
}
```

#### 2. 과목별 주당 배정 일수 설정

**구현 방안**:
- Step 5에 전략과목별 주당 배정 일수 설정 UI 추가
- 드롭다운 또는 숫자 입력으로 설정

### 우선순위 2: today/weekly 모드 스케줄러 활용

#### 1. today 모드 스케줄러 활용

**구현 방안**:
- today 모드에서도 플래너의 시간 설정 활용
- 기존 타임라인 고려하여 빈 시간대에 배치
- Best Fit 알고리즘 적용

#### 2. weekly 모드 스케줄러 활용

**구현 방안**:
- weekly 모드에서도 플래너의 시간 설정 활용
- 주간 타임라인 고려하여 배치
- Best Fit 알고리즘 적용

### 우선순위 3: Dock과 타임라인 통합

#### 1. Dock에 타임라인 정보 표시

**구현 방안**:
- DailyDock에 오늘의 타임라인 표시
- WeeklyDock에 주간 타임라인 표시
- 타임라인 기반 플랜 배치 시각화

#### 2. 관리자 플랜 관리 페이지 타임라인 시각화

**구현 방안**:
- 플랜 관리 페이지에 타임라인 뷰 추가
- Dock과 타임라인 통합 표시
- 플랜 드래그 앤 드롭으로 타임라인 조정

### 우선순위 4: SchedulerEngine 개선

#### 1. 기존 플랜 정보를 Context에 포함

**구현 방안**:
- `SchedulerContext`에 `existingPlans` 필드 추가
- `generateStudyDayPlans`에서 기존 플랜 반영
- `slotAvailability` 초기화 시 기존 플랜 시간 반영

---

## 결론

### 현재 상태 요약

#### ✅ 잘 구현된 부분

1. **플래너 생성**
   - 스케줄러 유형 기본값: "1730_timetable"
   - 학습일/복습일 주기 설정
   - 학생 수준 정보 입력 가능

2. **period 모드 플랜 추가**
   - 스케줄러 활용
   - 기존 타임라인 고려
   - Best Fit 알고리즘 적용

3. **Dock 컴포넌트**
   - React Query로 데이터 조회
   - 캐시 무효화 지원

#### ⚠️ 개선이 필요한 부분 [2026-01-08 업데이트]

1. ~~**필수 입력 항목 누락**~~ ✅ **Phase 1 완료**
   - ~~전략과목/취약과목 정보 입력 UI 없음~~ → ✅ 완료
   - ~~과목별 주당 배정 일수 설정 불가~~ → ✅ 완료

2. ~~**today/weekly 모드**~~ ✅ **Phase 2 완료**
   - ~~today 모드 스케줄러 미활용~~ → ✅ 완료 (useScheduler 옵션 추가)
   - ~~today 모드 타임라인 미고려~~ → ✅ 완료 (기존 플랜 충돌 방지)
   - weekly 모드: 유연성 유지를 위해 의도적으로 스케줄러 미적용

3. **Dock과 타임라인 통합** (Phase 3)
   - Dock에서 타임라인 정보 표시 없음
   - 관리자 플랜 관리 페이지 타임라인 시각화 없음

### 권장 구현 순서

1. ~~**Phase 1 (필수)**: 전략과목/취약과목 정보 입력 UI 추가~~ ✅ **완료 (2026-01-15)**
2. ~~**Phase 2 (중요)**: today 모드 스케줄러 활용~~ ✅ **완료 (2026-01-08)**
   - Weekly 모드는 유연성 유지를 위해 스케줄러 미적용 결정
3. **Phase 3 (개선)**: Dock과 타임라인 통합
4. **Phase 4 (선택)**: SchedulerEngine 개선

---

## Phase 1 구현 완료 (2026-01-15)

### ✅ 구현 내용

#### 1. 타입 시스템 업데이트
**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/types.ts`
```typescript
export interface SelectedContent {
  // ... 기존 필드
  /** 전략 과목 주간 배정일 (2, 3, 4). 전략 과목인 경우에만 유효 */
  weeklyDays?: 2 | 3 | 4 | null;
}
```

#### 2. UI 구현 (Step 4)
**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step4ContentSelection.tsx`

**추가된 기능**:
- 상수: `WEEKLY_DAYS_OPTIONS` (미지정, 2일, 3일, 4일)
- 핸들러: `handleUpdateWeeklyDays` (주간 배정일 업데이트)
- 핸들러 수정: `handleUpdateSubjectType` (과목 유형 변경 시 weeklyDays 자동 초기화)
- UI: 전략과목 선택 시 주간 배정일 버튼 표시 (조건부 렌더링)

**UI 동작**:
```
[전략 과목] 선택
    ↓
주간 배정일 섹션 표시
[미지정] [2일] [3일] [4일]
    ↓
선택 → 오렌지색 하이라이트
```

**위치**: Line 518-545

#### 3. 제출 로직 구현 (Step 7)
**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**추가된 로직**:
```typescript
// content_allocations 생성
const contentAllocations = skipContents
  ? []
  : selectedContents
      .filter((c) => c.subjectType !== null)
      .map((c) => ({
        content_type: c.contentType as "book" | "lecture",
        content_id: c.contentId,
        subject_type: c.subjectType as "strategy" | "weakness",
        weekly_days: c.subjectType === "strategy" && c.weeklyDays ? c.weeklyDays : undefined,
      }));

// schedulerOptions에 병합
const enhancedSchedulerOptions = {
  ...schedulerOptions,
  content_allocations: contentAllocations.length > 0 ? contentAllocations : undefined,
};
```

**적용 위치**:
- `handleSubmit`: Line 400-416
- `handleAutoSave`: Line 232-248

#### 4. 데이터 흐름

```
Step 4 UI 입력
    ↓
wizardData.selectedContents[].weeklyDays 저장
    ↓
Step 7 제출
    ↓
content_allocations 생성
  - subjectType !== null만 필터링
  - 전략과목이고 weeklyDays가 있으면 포함
  - null → undefined 변환
    ↓
scheduler_options.content_allocations
    ↓
DB: plan_groups.scheduler_options (JSONB)
```

### 📊 구현 결과

#### 수정된 파일
1. `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/types.ts` (Line 43)
2. `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step4ContentSelection.tsx` (Lines 55-60, 169-197, 518-566)
3. `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx` (Lines 400-416, 232-248)

#### 검증 완료
- ✅ TypeScript 컴파일 성공
- ✅ Next.js 빌드 성공
- ✅ ESLint 검사 통과 (수정 파일 기준)

### 🔄 다음 단계

#### 스케줄러 통합 (필요 시)
1. **SchedulerEngine에서 content_allocations 활용**
   - `scheduler_options.content_allocations` 읽기
   - 전략과목: 주당 배정 일수 반영
   - 취약과목: 보정 계수(×1.2) 적용
   - 전략과목: 보정 계수(×1.0~1.1) 적용

2. **검증 방법**
   ```sql
   -- DB 확인
   SELECT
     id,
     name,
     scheduler_options->'content_allocations' as allocations
   FROM plan_groups
   WHERE id = '<생성된 플랜 그룹 ID>';
   ```

   **기대 결과**:
   ```json
   {
     "content_allocations": [
       {
         "content_type": "book",
         "content_id": "...",
         "subject_type": "strategy",
         "weekly_days": 3
       },
       {
         "content_type": "lecture",
         "content_id": "...",
         "subject_type": "weakness"
       }
     ]
   }
   ```

---

## Phase 2 구현 완료 (2026-01-08)

### ✅ 구현 내용

#### 1. today 모드 스케줄러 통합

**목적**: today 모드에서 콘텐츠 추가 시 기존 플랜 타임라인을 고려하여 자동 시간 배정

**구현 방식**: Option C - 기존 함수에 스케줄러 옵션 추가

#### 2. 신규 파일 생성

##### `lib/domains/admin-plan/utils/durationCalculator.ts`
```typescript
/**
 * 콘텐츠 타입과 볼륨 기반 소요시간 계산
 */
export function calculateEstimatedMinutes(
  totalVolume: number | null | undefined,
  contentType: string
): number {
  if (!totalVolume || totalVolume <= 0) return 30;
  switch (contentType) {
    case 'lecture': return totalVolume * 30;  // 에피소드당 30분
    case 'book': return Math.ceil(totalVolume * 2);  // 페이지당 2분
    case 'custom': return Math.ceil(totalVolume * 1.5);
    default: return 30;
  }
}
```

##### `lib/domains/admin-plan/actions/planCreation/singleDayScheduler.ts`
```typescript
export interface SingleDayScheduleInput {
  studentId: string;
  plannerId: string;
  targetDate: string;
  estimatedMinutes: number;
}

export interface SingleDayScheduleResult {
  success: boolean;
  startTime?: string;
  endTime?: string;
  error?: string;
}

/**
 * 단일 날짜에서 Best Fit 알고리즘으로 사용 가능한 시간 슬롯 찾기
 */
export async function findAvailableTimeSlot(
  input: SingleDayScheduleInput
): Promise<SingleDayScheduleResult>
```

**Best Fit 알고리즘**:
1. `generateScheduleForPlanner()` - 플래너 시간 설정 조회
2. `getExistingPlansForStudent()` - 기존 플랜 조회
3. `adjustDateTimeSlotsWithExistingPlans()` - 충돌 시간 제거
4. 가장 작은 적합 슬롯 선택
5. `{ startTime, endTime }` 반환

#### 3. 기존 파일 수정

##### `lib/domains/admin-plan/actions/createPlanFromContent.ts`

**인터페이스 확장**:
```typescript
export interface CreatePlanFromContentInput {
  // ... 기존 필드 ...

  // 스케줄러 옵션 (today 모드 전용)
  /** 스케줄러를 사용한 자동 시간 배정 활성화 (기본: false) */
  useScheduler?: boolean;
  /** 예상 소요시간 (분). 지정하지 않으면 콘텐츠 타입과 볼륨으로 자동 계산 */
  estimatedMinutes?: number;
}
```

**today 모드 분기 수정**:
```typescript
if (input.distributionMode === 'today') {
  let startTime: string | undefined;
  let endTime: string | undefined;

  // 스케줄러가 활성화된 경우 Best Fit으로 시간 슬롯 찾기
  if (input.useScheduler && input.plannerId) {
    const estimatedMinutes = input.estimatedMinutes ||
      calculateEstimatedMinutes(input.totalVolume, flexibleContent.content_type);

    const scheduleResult = await findAvailableTimeSlot({
      studentId: input.studentId,
      plannerId: input.plannerId,
      targetDate: input.targetDate,
      estimatedMinutes,
    });

    if (scheduleResult.success) {
      startTime = scheduleResult.startTime;
      endTime = scheduleResult.endTime;
    }
  }

  plansToCreate.push(createPlanRecord({
    ...existingFields,
    startTime,
    endTime,
  }));
}
```

**`createPlanRecord()` 함수 확장**:
```typescript
function createPlanRecord(params: {
  // ... 기존 파라미터 ...
  startTime?: string;
  endTime?: string;
}) {
  return {
    // ... 기존 필드 ...
    start_time: params.startTime || null,
    end_time: params.endTime || null,
  };
}
```

##### UI 수정 파일

1. **`AddContentModal.tsx`**
   - `useScheduler` 상태 추가
   - today 모드 선택 시 "자동 시간 배정 (기존 플랜 고려)" 체크박스 표시
   - `planInput`에 `useScheduler` 전달

2. **`add-content-wizard/types.ts`**
   - `AddContentWizardData` 인터페이스에 `useScheduler: boolean` 추가
   - `initialWizardData`에 `useScheduler: false` 기본값 설정

3. **`add-content-wizard/steps/Step3Distribution.tsx`**
   - today 모드 선택 시 체크박스 UI 표시
   ```tsx
   {mode === 'today' && data.distributionMode === 'today' && (
     <div className="px-4 pb-4">
       <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
         <input
           type="checkbox"
           checked={data.useScheduler}
           onChange={(e) => onChange({ useScheduler: e.target.checked })}
         />
         자동 시간 배정 (기존 플랜 고려)
       </label>
     </div>
   )}
   ```

4. **`add-content-wizard/AddContentWizard.tsx`**
   - `planInput`에 `useScheduler` 옵션 전달

#### 4. 데이터 흐름

```
AddContentModal / AddContentWizard
    │
    │  useScheduler: true (체크박스 선택)
    ▼
createPlanFromContent()
    │
    ├── distributionMode === 'today'
    │         │
    │         ▼
    │   findAvailableTimeSlot()
    │         │
    │         ├── generateScheduleForPlanner() ─── 플래너 시간 설정
    │         ├── getExistingPlansForStudent() ── 기존 플랜 조회
    │         ├── adjustDateTimeSlotsWithExistingPlans() ── 충돌 제거
    │         └── Best Fit Algorithm ─────────── 최적 슬롯 선택
    │                   │
    │                   ▼
    │         { startTime, endTime }
    │
    ▼
createPlanRecord({ startTime, endTime })
    │
    ▼
student_plan 테이블 INSERT (start_time, end_time 포함)
```

#### 5. 설계 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| **Weekly 모드** | 스케줄러 미적용 유지 | Weekly dock의 "유동적 플랜" 특성 유지 |
| **기본값** | UI 체크박스 제공 (false) | 사용자가 명시적으로 선택하도록 |
| **실패 처리** | 시간 없이 생성 (graceful fallback) | 플랜 생성은 항상 보장 |

### 📊 구현 결과

#### 신규 파일
| 파일 | 역할 |
|------|------|
| `lib/domains/admin-plan/utils/durationCalculator.ts` | 소요시간 계산 유틸 |
| `lib/domains/admin-plan/actions/planCreation/singleDayScheduler.ts` | 단일 날짜 Best Fit 스케줄러 |

#### 수정 파일
| 파일 | 수정 내용 |
|------|----------|
| `lib/domains/admin-plan/actions/createPlanFromContent.ts` | 인터페이스 확장, today 모드 스케줄러 통합 |
| `lib/domains/admin-plan/actions/planCreation/index.ts` | singleDayScheduler export 추가 |
| `AddContentModal.tsx` | useScheduler 상태 및 UI 추가 |
| `add-content-wizard/types.ts` | useScheduler 필드 추가 |
| `add-content-wizard/steps/Step3Distribution.tsx` | 체크박스 UI 추가 |
| `add-content-wizard/AddContentWizard.tsx` | planInput에 useScheduler 전달 |

#### 검증 완료
- ✅ TypeScript 컴파일 성공
- ✅ Next.js 빌드 성공 (172 페이지)
- ✅ ESLint 검사 통과 (에러 없음)

---

## Phase 3 구현 완료 (2026-01-08)

### ✅ 구현 내용

#### 1. DailyDock 타임라인 통합

**목적**: DailyDock 상단에 오늘의 타임라인 바를 표시하고, 각 플랜에 시작-종료 시간 정보 표시

**커밋**: `32a65184`

#### 2. 구현된 파일

##### `lib/query-options/adminDock.ts` - DailyPlan 타입 확장

```typescript
export interface DailyPlan {
  // ... 기존 필드
  start_time: string | null;       // 추가
  end_time: string | null;         // 추가
  estimated_minutes: number | null; // 추가
}
```

- 쿼리 select 절에 시간 필드 추가
- 플래너 필터링 시 plan_groups 조인에도 반영

##### `app/.../DailyDockTimeline.tsx` (신규 생성)

```typescript
interface DailyDockTimelineProps {
  plans: DailyPlan[];
  displayRange?: { start: string; end: string };
  compact?: boolean;
}

export function DailyDockTimeline({ plans, ... }: DailyDockTimelineProps)
```

**기능**:
- 오늘의 플랜들을 타임라인 바로 시각화
- 완료/진행 중 플랜 색상 구분 (녹색/파랑)
- 2시간 단위 시간 눈금 표시
- 총 배정 시간 표시
- 호버 시 플랜 상세 정보 툴팁

##### `app/.../DailyDock.tsx` - 타임라인 통합

```tsx
{/* 타임라인 */}
{allPlans.length > 0 && (
  <div className="px-4 pt-3">
    <DailyDockTimeline plans={allPlans} />
  </div>
)}

{/* PlanItemCard에 showTime 적용 */}
<PlanItemCard
  plan={planData}
  showTime={true}  // 추가
  ...
/>
```

##### `app/.../items/PlanItemCard.tsx` - 시간 데이터 매핑

```typescript
// toPlanItemData 함수에 추가
estimatedMinutes: raw.estimated_minutes,
```

### 📊 구현 결과

| 구현 항목 | 상태 |
|-----------|------|
| DailyPlan 타입에 시간 필드 추가 | ✅ 완료 |
| DailyDockTimeline 컴포넌트 생성 | ✅ 완료 |
| DailyDock에 타임라인 통합 | ✅ 완료 |
| PlanItemCard에 showTime 적용 | ✅ 완료 |

---

## Phase 4 구현 완료 (2026-01-08)

### ✅ 구현 내용

#### 1. SchedulerEngine 개선

**목적**: SchedulerEngine이 기존 플랜 정보를 직접 인식하여 시간 충돌 방지

**커밋**: `32a65184`

#### 2. 구현된 변경사항

##### `lib/scheduler/SchedulerEngine.ts`

**ExistingPlanInfo 인터페이스 추가**:
```typescript
export interface ExistingPlanInfo {
  date: string;
  start_time: string;
  end_time: string;
}

export type SchedulerContext = {
  // ... 기존 필드
  existingPlans?: ExistingPlanInfo[];  // 추가
};
```

**calculateUsedTimeForSlot 헬퍼 메서드 추가**:
```typescript
private calculateUsedTimeForSlot(
  slot: { start: string; end: string },
  existingPlansForDate: ExistingPlanInfo[]
): number {
  let usedTime = 0;
  const slotStart = timeToMinutes(slot.start);
  const slotEnd = timeToMinutes(slot.end);

  for (const plan of existingPlansForDate) {
    const planStart = timeToMinutes(plan.start_time);
    const planEnd = timeToMinutes(plan.end_time);
    const overlapStart = Math.max(slotStart, planStart);
    const overlapEnd = Math.min(slotEnd, planEnd);
    if (overlapEnd > overlapStart) {
      usedTime += overlapEnd - overlapStart;
    }
  }
  return usedTime;
}
```

**slotAvailability 초기화 개선**:
```typescript
// generateStudyDayPlans에서 기존 플랜 시간 반영
const existingPlansForDate = this.context.existingPlans?.filter(
  (p) => p.date === date
) || [];

const slotAvailability = studyTimeSlots.map((slot) => ({
  slot,
  usedTime: this.calculateUsedTimeForSlot(slot, existingPlansForDate),
}));
```

##### `lib/plan/scheduler.ts`

```typescript
import { type ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";

export async function generatePlansFromGroup(
  // ... 기존 파라미터
  periodEnd?: string,
  existingPlans?: ExistingPlanInfo[]  // 추가
): Promise<ScheduledPlan[]>

// SchedulerContext에 existingPlans 전달
const context: SchedulerContext = {
  // ... 기존 필드
  existingPlans,
};
```

##### `lib/domains/admin-plan/actions/createPlanFromContent.ts`

```typescript
// 기존 플랜을 ExistingPlanInfo 형식으로 변환
const existingPlansForScheduler = existingPlans.map((p) => ({
  date: p.plan_date,
  start_time: p.start_time,
  end_time: p.end_time,
}));

// generatePlansFromGroup에 전달
const scheduledPlans = await generatePlansFromGroup(
  // ... 기존 파라미터
  existingPlansForScheduler
);
```

### 📊 구현 결과

| 구현 항목 | 상태 |
|-----------|------|
| ExistingPlanInfo 인터페이스 추가 | ✅ 완료 |
| calculateUsedTimeForSlot 메서드 추가 | ✅ 완료 |
| slotAvailability 초기화 시 기존 플랜 반영 | ✅ 완료 |
| generatePlansFromGroup에 existingPlans 전달 | ✅ 완료 |
| createPlanFromContent에서 통합 | ✅ 완료 |

### 🔧 데이터 흐름

```
createPlanFromContent()
    │
    ├── getExistingPlansForStudent() ─── 기존 플랜 조회
    │         │
    │         ▼
    │   existingPlans: { date, start_time, end_time }[]
    │
    ▼
generatePlansFromGroup(existingPlans)
    │
    ▼
SchedulerEngine.generate(context: { existingPlans })
    │
    ├── generateStudyDayPlans()
    │         │
    │         ├── calculateUsedTimeForSlot() ─── 슬롯별 사용 시간 계산
    │         │
    │         ▼
    │   slotAvailability = [{ slot, usedTime: 이미_사용된_시간 }]
    │
    ▼
Best Fit Algorithm (기존 플랜 시간 고려)
```

---

## 추가 버그 수정 (2026-01-08)

### getFilteredPlans 플래너 필터링

**커밋**: `4ef34c7c`

**문제**: `getFilteredPlans` 함수에 `plannerId` 파라미터가 없어 플래너 기반 필터링 불가

**해결**:
```typescript
// lib/domains/admin-plan/actions/filter.ts
export interface PlanFilterParams {
  studentId: string;
  plannerId?: string;  // 추가
  // ...
}

// plan_groups와 조인하여 플래너 필터링
let query = params.plannerId
  ? supabase
      .from('student_plan')
      .select(`${selectFields}, plan_groups!inner(planner_id)`, { count: 'exact' })
      .eq('plan_groups.planner_id', params.plannerId)
  : supabase
      .from('student_plan')
      .select(selectFields, { count: 'exact' });
```

---

## 전체 구현 완료 상태

### 완료된 Phase

| Phase | 내용 | 커밋 | 상태 |
|-------|------|------|------|
| Phase 1 | 전략/취약과목 입력 UI | 2026-01-15 | ✅ 완료 |
| Phase 2 | today 모드 스케줄러 통합 | 2026-01-08 | ✅ 완료 |
| Phase 3 | DailyDock 타임라인 통합 | `32a65184` | ✅ 완료 |
| Phase 4 | SchedulerEngine 개선 | `32a65184` | ✅ 완료 |

### 검증 완료

- ✅ TypeScript 컴파일 성공
- ✅ Next.js 빌드 성공 (172 페이지)
- ✅ ESLint 검사 통과 (수정 파일 기준)

### 🔄 향후 개선 가능 작업

#### 선택적 개선

1. **WeeklyDock 타임라인 통합**
   - 주간 타임라인 시각화 (현재 DailyDock만 적용)

2. **콘텐츠 소요시간 정밀화**
   - Episode 기반 정확한 duration 계산

3. **UI 개선**
   - 플랜 생성 전 미리보기 기능
   - 기존/신규 플랜 시각적 구분

4. **테스트 코드**
   - Phase 3/4 기능에 대한 단위 테스트 작성

5. **과목별 보정 계수 적용**
   - content_allocations 기반 보정 계수 스케줄러 적용
   - 취약과목: ×1.2, 전략과목: ×1.0~1.1

---

**작성자**: AI Assistant
**최종 업데이트**: 2026-01-08 (Phase 3 + Phase 4 완료)
**구현자**: Claude Opus 4.5

