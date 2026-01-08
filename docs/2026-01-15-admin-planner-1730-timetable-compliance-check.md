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

#### 2. 전략과목/취약과목 정보 ⚠️ **부분 구현**
```typescript
{
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목인 경우: 2, 3, 4
}
```

**영향**:
- 소요시간 계산 시 과목별 보정 계수가 적용되지 않음
  - 취약과목: ×1.2
  - 전략과목: ×1.0~1.1
- 과목 배정 방식 결정 불가

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

##### Step 4: 콘텐츠 선택 ✅
- 학생 콘텐츠 선택
- 콘텐츠 범위 설정

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

### 문제점 요약

#### ❌ 누락된 필수 입력 항목

1. **전략과목/취약과목 정보**
   - 현재 상태: Step 5에서 과목별 유형 설정 불가
   - 영향: 소요시간 계산 시 과목별 보정 계수 미적용
   - 권장 해결 방법:
     - Step 4 또는 Step 5에 과목별 유형 설정 UI 추가
     - 각 콘텐츠 선택 시 "전략과목" 또는 "취약과목" 선택
     - 전략과목인 경우 주당 배정 일수 선택 (2, 3, 4)

2. **과목별 주당 배정 일수**
   - 현재 상태: 전략과목의 주당 배정 일수 설정 불가
   - 영향: 전략과목 배정 방식 결정 불가
   - 권장 해결 방법:
     - Step 5에 전략과목별 주당 배정 일수 설정 UI 추가

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

### 문제점 요약

#### ⚠️ today/weekly 모드에서 스케줄러 미활용

**현재 상태**:
- `today` 모드: 오늘 날짜에 단일 플랜 추가 (단순 배치)
- `weekly` 모드: 주간 Dock에 단일 플랜 추가 (단순 배치)
- `period` 모드: 스케줄러 활용 (Best Fit 알고리즘)

**영향**:
- today/weekly 모드에서 플래너의 시간 설정 미활용
- 기존 타임라인 미고려 (시간 충돌 가능)
- Best Fit 알고리즘 미적용

**권장 해결 방법**:
- today/weekly 모드에서도 스케줄러 활용 옵션 제공
- 또는 today/weekly 모드에서도 기존 타임라인 고려

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

#### ⚠️ 개선이 필요한 부분

1. **필수 입력 항목 누락**
   - 전략과목/취약과목 정보 입력 UI 없음
   - 과목별 주당 배정 일수 설정 불가

2. **today/weekly 모드**
   - 스케줄러 미활용
   - 타임라인 미고려

3. **Dock과 타임라인 통합**
   - Dock에서 타임라인 정보 표시 없음
   - 관리자 플랜 관리 페이지 타임라인 시각화 없음

### 권장 구현 순서

1. **Phase 1 (필수)**: 전략과목/취약과목 정보 입력 UI 추가
2. **Phase 2 (중요)**: today/weekly 모드 스케줄러 활용
3. **Phase 3 (개선)**: Dock과 타임라인 통합
4. **Phase 4 (선택)**: SchedulerEngine 개선

---

**작성자**: AI Assistant  
**최종 업데이트**: 2026-01-15

