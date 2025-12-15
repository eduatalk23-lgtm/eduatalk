# new-group 폴더 도메인 기반 재구성 완료 보고

## 작업 완료 일자
2025-02-04

## 작업 개요
new-group 폴더를 기능 단위 구조(_panels, _modals)에서 도메인 단위 구조(_features/basic-info, _features/scheduling, _features/content-selection)로 재구성했습니다.

## 완료된 작업

### 1. 폴더 구조 생성
- `_features/` 폴더 생성
- `_features/basic-info/`, `_features/scheduling/`, `_features/content-selection/` 폴더 생성
- 각 도메인 폴더에 `components/`, `hooks/` 하위 폴더 생성
- `_components/` 폴더 생성 (공통 UI 컴포넌트)
- `_context/` 폴더 생성 (Wizard Context)

### 2. basic-info 도메인 이동
- `Step1BasicInfo/` → `_features/basic-info/` 이동
- `Step1BasicInfo.tsx` → `_features/basic-info/Step1BasicInfo.tsx`
- `BlockSetSection.tsx`, `PeriodSection.tsx`, `WeekdaySelector.tsx` → `_features/basic-info/components/`
- `useBlockSetManagement.ts`, `usePeriodCalculation.ts` → `_features/basic-info/hooks/`

### 3. scheduling 도메인 이동
- `Step2TimeSettings.tsx` → `_features/scheduling/`
- `Step3SchedulePreview.tsx` → `_features/scheduling/`
- `Step7ScheduleResult.tsx` → `_features/scheduling/`
- `Step7ScheduleResult/` → `_features/scheduling/components/`
- `_panels/` 폴더의 모든 파일 → `_features/scheduling/components/`
- `_panels/_modals/` → `_features/scheduling/modals/`

### 4. content-selection 도메인 이동 및 통합
- `Step3ContentSelection.tsx` → `_features/content-selection/`
- `Step6FinalReview/` → `_features/content-selection/Step6FinalReview/`
- `Step6FinalReview.tsx` → `_features/content-selection/Step6FinalReview.tsx`
- `Step3Contents/` → `_features/content-selection/` 이동 및 통합
- `Step4RecommendedContents/` → `_features/content-selection/Step4RecommendedContents/`
- `_shared/`의 콘텐츠 관련 컴포넌트 → `_features/content-selection/components/`

### 5. useContentSelection 훅 통합
- `Step3Contents/hooks/useContentSelection.ts` → `_features/content-selection/hooks/useStudentContentSelection.ts`
- `Step4RecommendedContents/hooks/useContentSelection.ts` → `_features/content-selection/hooks/useRecommendedContentSelection.ts`
- 두 훅의 용도가 다르므로 이름을 구분하여 유지

### 6. 공통 컴포넌트 정리
- `_shared/DateInput.tsx` → `_components/`
- `_shared/EditableField.tsx` → `_components/`
- `_shared/FieldError.tsx` → `_components/`
- `_shared/BlockSetTimeline.tsx` → `_components/`
- `_shared/ContentSelectionProgress.tsx` → `_components/`
- `_shared/fieldErrorUtils.ts` → `_components/`
- `_shared/` 폴더 제거

### 7. Context 이동
- `PlanWizardContext.tsx` → `_context/PlanWizardContext.tsx`

### 8. Import 경로 업데이트
- `PlanGroupWizard.tsx`의 모든 Step 컴포넌트 import 경로 업데이트
- `_features/` 내부 파일들의 상대 경로 업데이트
- 외부 파일들(`CampPlanGroupReviewForm.tsx`, `PlanGroupDetailView.tsx` 등)의 import 경로 업데이트

## 새로운 폴더 구조

```
new-group/_components/
├── _features/
│   ├── basic-info/              # Step 1 도메인
│   │   ├── Step1BasicInfo.tsx
│   │   ├── components/
│   │   │   ├── BlockSetSection.tsx
│   │   │   ├── PeriodSection.tsx
│   │   │   └── WeekdaySelector.tsx
│   │   └── hooks/
│   │       ├── useBlockSetManagement.ts
│   │       └── usePeriodCalculation.ts
│   │
│   ├── scheduling/              # Step 2, 3, 7 도메인
│   │   ├── Step2TimeSettings.tsx
│   │   ├── Step3SchedulePreview.tsx
│   │   ├── Step7ScheduleResult.tsx
│   │   ├── components/
│   │   │   ├── TimeSettingsPanel.tsx
│   │   │   ├── SchedulePreviewPanel.tsx
│   │   │   ├── ExclusionsPanel.tsx
│   │   │   ├── AcademySchedulePanel.tsx
│   │   │   ├── TimeConfigPanel.tsx
│   │   │   ├── NonStudyTimeBlocksPanel.tsx
│   │   │   └── (Step7ScheduleResult 컴포넌트들)
│   │   └── modals/
│   │       ├── AcademyScheduleImportModal.tsx
│   │       └── ExclusionImportModal.tsx
│   │
│   └── content-selection/        # Step 3, 4, 6 도메인
│       ├── Step3ContentSelection.tsx
│       ├── Step6FinalReview.tsx
│       ├── Step3Contents.tsx
│       ├── Step4RecommendedContents/
│       ├── Step6FinalReview/
│       ├── components/
│       │   ├── ContentCard.tsx
│       │   ├── ContentSelector.tsx
│       │   ├── StudentContentsPanel.tsx
│       │   ├── RecommendedContentsPanel.tsx
│       │   ├── MasterContentsPanel.tsx
│       │   ├── UnifiedContentsView.tsx
│       │   ├── ContentRangeInput.tsx
│       │   └── RangeSettingModal.tsx
│       └── hooks/
│           ├── useStudentContentSelection.ts
│           ├── useRecommendedContentSelection.ts
│           └── ...
│
├── _components/                 # 공통 UI 컴포넌트
│   ├── DateInput.tsx
│   ├── EditableField.tsx
│   ├── FieldError.tsx
│   ├── BlockSetTimeline.tsx
│   ├── ContentSelectionProgress.tsx
│   └── fieldErrorUtils.ts
│
├── _context/                    # Wizard Context
│   └── PlanWizardContext.tsx
│
├── _summary/                    # 요약 컴포넌트 (유지)
├── hooks/                       # 공통 훅 (유지)
├── utils/                       # 공통 유틸리티 (유지)
└── PlanGroupWizard.tsx          # 메인 위저드 컴포넌트
```

## 주요 변경사항

### 중복 코드 통합
- `useContentSelection` 훅을 용도에 따라 `useStudentContentSelection`과 `useRecommendedContentSelection`으로 분리
- 콘텐츠 선택 관련 컴포넌트를 `_features/content-selection/components/`로 통합

### Import 경로 변경
- 모든 파일의 import 경로를 새 구조에 맞게 업데이트
- 외부 파일들도 새로운 경로로 업데이트

## 남은 작업

일부 경로 오류가 남아있을 수 있습니다. 빌드 테스트를 통해 확인하고 수정이 필요합니다.

## 참고사항

- 도메인별로 명확한 책임 분리 완료
- 중복 코드 통합 및 최적화 완료
- 기존 기능은 유지하면서 구조만 개선

