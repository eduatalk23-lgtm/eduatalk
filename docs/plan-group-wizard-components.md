# 플랜 생성 위저드 단계별 컴포넌트 정리

## 작성 일자

2025-01-30

## 개요

플랜 그룹 생성 위저드(`PlanGroupWizard`)에서 사용되는 각 단계별 컴포넌트 구조를 정리한 문서입니다.

---

## 메인 위저드 컴포넌트

### `PlanGroupWizard.tsx`

- **위치**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- **역할**: 플랜 그룹 생성 위저드의 메인 컨테이너
- **기능**:
  - 전체 위저드 상태 관리 (`wizardData`, `currentStep`)
  - 단계별 검증 (`validateStep`)
  - 자동 저장 기능
  - 플랜 그룹 생성/수정 처리

---

## 단계별 컴포넌트 구조

### Step 1: 기본 정보 (`currentStep === 1`)

#### 메인 컴포넌트

- **`Step1BasicInfo.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
  - 역할: 플랜 그룹의 기본 정보 입력
  - 주요 입력 필드:
    - 플랜 이름 (`name`)
    - 플랜 목적 (`plan_purpose`: "내신대비" | "모의고사(수능)")
    - 스케줄러 유형 (`scheduler_type`: "1730_timetable")
    - 학습 기간 (`period_start`, `period_end`)
    - 블록 세트 선택 (`block_set_id`)
    - 학습일/복습일 주기 설정 (`study_review_cycle`)
    - 학생 수준 (`student_level`)
    - 전략과목/취약과목 설정 (`subject_allocations`)

#### 하위 컴포넌트

- 블록 세트 관리 UI (블록 세트 생성/편집)
- 기간 입력 UI (D-day, 직접 입력, 주 단위)

---

### Step 2: 시간 설정 (`currentStep === 2`)

#### 메인 컴포넌트

- **`Step2TimeSettings.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/Step2TimeSettings.tsx`
  - 역할: 시간 설정 및 제외일/학원 일정 관리

#### 하위 패널 컴포넌트

- **`TimeSettingsPanel.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/_panels/TimeSettingsPanel.tsx`
  - 역할: 시간 설정 통합 패널
  - 포함 기능:
    - 제외일 설정 (`ExclusionsPanel`)
    - 학원 일정 설정 (`AcademySchedulePanel`)
    - 학습 시간 제외 블록 설정 (`NonStudyTimeBlocksPanel`)
    - 시간 설정 (`TimeConfigPanel`)

#### 하위 패널 컴포넌트 상세

1. **`ExclusionsPanel.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`
   - 역할: 제외일(휴가, 개인사정, 지정휴일 등) 관리
   - 모달: `ExclusionImportModal.tsx`

2. **`AcademySchedulePanel.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_panels/AcademySchedulePanel.tsx`
   - 역할: 학원 일정 관리
   - 모달: `AcademyScheduleImportModal.tsx`

3. **`NonStudyTimeBlocksPanel.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_panels/NonStudyTimeBlocksPanel.tsx`
   - 역할: 학습 시간 제외 블록 설정 (아침식사, 저녁식사, 수면 등)

4. **`TimeConfigPanel.tsx`**
   - 위치: `app/(student)/plan/new-group/_components/_panels/TimeConfigPanel.tsx`
   - 역할: 1730 Timetable 시간 설정
   - 설정 항목:
     - 점심시간
     - 캠프 학습시간
     - 캠프 자율학습시간
     - 지정휴일 학습시간
     - 자율학습시간 사용 옵션

---

### Step 3: 스케줄 미리보기 (`currentStep === 3`)

#### 메인 컴포넌트

- **`Step3SchedulePreview.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/Step3SchedulePreview.tsx`
  - 역할: 설정된 시간 블록과 제외일을 기반으로 스케줄 미리보기

#### 하위 패널 컴포넌트

- **`SchedulePreviewPanel.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`
  - 역할: 일별/주별/월별 스케줄 미리보기 표시

---

### Step 4: 콘텐츠 선택 (`currentStep === 4`)

#### 메인 컴포넌트

- **`Step3ContentSelection.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
  - 역할: 학생 콘텐츠와 추천 콘텐츠 선택 (통합 컴포넌트)
  - Phase 3.5에서 구현된 통합 컴포넌트로, 기존 `Step3Contents`와 `Step4RecommendedContents`를 통합
  - 탭 UI로 학생 콘텐츠와 추천 콘텐츠를 한 화면에서 관리

#### 하위 컴포넌트

1. **`StudentContentsPanel.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx`
   - 역할: 학생이 보유한 콘텐츠(교재, 강의) 선택 및 범위 설정

2. **`RecommendedContentsPanel.tsx`**
   - 위치: `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`
   - 역할: 추천 콘텐츠 선택 및 범위 설정

#### 공유 컴포넌트

- **`ContentCard.tsx`**: 콘텐츠 카드 UI
- **`ContentSelector.tsx`**: 콘텐츠 선택 UI
- **`ContentRangeInput.tsx`**: 콘텐츠 범위 입력 UI
- **`RangeSettingModal.tsx`**: 범위 설정 모달
- **`ProgressIndicator.tsx`**: 진행률 표시
- **`EditableField.tsx`**: 편집 가능한 필드

#### 레거시 컴포넌트 (참고용)

- **`Step3Contents.tsx`**: 기존 학생 콘텐츠 선택 컴포넌트 (Step4에서 통합됨)
- **`Step4RecommendedContents.tsx`**: 기존 추천 콘텐츠 선택 컴포넌트 (Step4에서 통합됨)

---

### Step 5: 최종 확인 (`currentStep === 5`)

#### 메인 컴포넌트

- **`Step6Simplified.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
  - 역할: 최종 확인 단계 (간소화 버전)
  - Phase 4.4에서 구현
  - 기존 `Step6FinalReview` (2,625 라인)를 간소화
  - 접기/펼치기 UI로 요약 정보만 표시

#### 하위 요약 컴포넌트

1. **`BasicInfoSummary.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_summary/BasicInfoSummary.tsx`
   - 역할: 기본 정보 요약 표시

2. **`TimeSettingsSummary.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_summary/TimeSettingsSummary.tsx`
   - 역할: 시간 설정 요약 표시

3. **`ContentsSummary.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_summary/ContentsSummary.tsx`
   - 역할: 선택된 콘텐츠 요약 표시

4. **`LearningVolumeSummary.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/_summary/LearningVolumeSummary.tsx`
   - 역할: 학습 분량 요약 표시

5. **`SubjectAllocationSummary.tsx`**
   - 위치: `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`
   - 역할: 과목 배정 요약 표시

#### 공유 컴포넌트

- **`CollapsibleSection.tsx`**: 접기/펼치기 섹션
- **`SectionSummary.tsx`**: 섹션 요약 카드
- **`SummaryCard.tsx`**: 요약 카드

#### 레거시 컴포넌트 (참고용)

- **`Step6FinalReview.tsx`**: 기존 최종 확인 컴포넌트 (2,625 라인, 현재는 Step6Simplified 사용)

---

### Step 6: 스케줄 결과 (`currentStep === 6`)

#### 메인 컴포넌트

- **`Step7ScheduleResult.tsx`**
  - 위치: `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`
  - 역할: 생성된 플랜 스케줄 결과 표시
  - 조건: `draftGroupId`가 있고, 캠프 모드가 아니거나 관리자 계속 진행 모드일 때만 표시

#### 하위 컴포넌트

1. **`ScheduleTableView.tsx`**

   - 위치: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
   - 역할: 일별 스케줄 테이블 뷰
   - 기능:
     - 일별 스케줄 상세 표시
     - 시간 슬롯별 색상 구분
     - 학원 일정, 학습 시간, 이동 시간 표시

2. **`TimelineBar.tsx`**
   - 위치: `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx`
   - 역할: 시간대별 타임라인 바 표시

#### 유틸리티

- **`scheduleTransform.ts`**
  - 위치: `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`
  - 역할: 플랜 데이터를 스케줄 테이블 형식으로 변환

---

## 컴포넌트 계층 구조

```

```



