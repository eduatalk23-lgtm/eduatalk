# TypeScript 에러 수정 (2025-01-27)

## 개요
프로젝트의 TypeScript 컴파일 에러를 수정했습니다. 총 15개의 에러가 있었으며, 모두 해결되었습니다.

## 수정된 에러 목록

### 1. Import 경로 수정

#### BlockSetSection.tsx
- **에러**: `Cannot find module '../../hooks/useBlockSetManagement'`
- **수정**: `../../hooks/useBlockSetManagement` → `../hooks/useBlockSetManagement`

#### PeriodSection.tsx
- **에러**: `Cannot find module '../../hooks/usePeriodCalculation'`
- **수정**: `../../hooks/usePeriodCalculation` → `../hooks/usePeriodCalculation`

- **에러**: `Cannot find module '../../../../hooks/useWizardValidation'`
- **수정**: `../../../../hooks/useWizardValidation` → `../../hooks/useWizardValidation`

### 2. 타입 문제 수정

#### StudentContentsPanel.tsx
- **에러**: `Argument of type '(prevContents: SelectedContent[]) => SelectedContent[]' is not assignable to parameter of type 'SelectedContent[]'`
- **수정**: `onUpdate`가 함수를 받는 대신 직접 배열을 받도록 수정

```typescript
// 수정 전
onUpdate((prevContents: SelectedContent[]) => {
  // ...
});

// 수정 후
const index = selectedContents.findIndex((c: SelectedContent) => c.content_id === contentId);
if (index >= 0) {
  const newContents = [...selectedContents];
  newContents[index] = updater(newContents[index]);
  onUpdate(newContents);
}
```

#### useRecommendedContentSelection.ts
- **에러**: `Module '"../types"' has no exported member 'RecommendedContent'`
- **수정**: 타입을 `@/lib/types/content-selection`에서 import하도록 변경

- **에러**: `Module '"../types"' has no exported member 'UseContentSelectionReturn'`
- **수정**: 타입을 파일 내부에서 정의하고 export

- **에러**: `Cannot find module '../constants'`
- **수정**: `../constants` → `../Step4RecommendedContents/constants`

### 3. 훅 경로 수정

#### Step3Contents.tsx
- **에러**: `Cannot find module './hooks/useContentSelection'`
- **수정**: `./hooks/useContentSelection` → `./hooks/useStudentContentSelection` (실제 함수명은 `useContentSelection`)

#### Step4RecommendedContentsRefactored.tsx
- **에러**: `Cannot find module './hooks/useContentSelection'`
- **수정**: `./hooks/useContentSelection` → `../hooks/useRecommendedContentSelection`

#### Step4RecommendedContents.tsx
- **에러**: `Cannot find name 'useContentSelection'`
- **수정**: `useContentSelection` → `useRecommendedContentSelection`

### 4. 컴포넌트 경로 수정

#### Step4RecommendedContentsRefactored.tsx
- **에러**: `Cannot find module '../../_components/ContentSelectionProgress'`
- **수정**: `../../_components/ContentSelectionProgress` → `../../../_components/ContentSelectionProgress`

### 5. 타입 불일치 수정

#### Step2TimeSettings.tsx
- **에러**: `Type '(step: WizardStep) => void' is not assignable to type '(step: number) => void'`
- **수정**: 타입 변환 함수 추가

```typescript
const finalOnNavigateToStep = onNavigateToStep 
  ? (step: number | WizardStep) => onNavigateToStep(step as WizardStep)
  : (step: number | WizardStep) => setStep(step as WizardStep);
```

### 6. 주석 블록 닫기

#### PlanGroupWizard.tsx
- **에러**: `Cannot find name 'stepWeights'`, `Cannot find name 'PlanGroupWizardProps'`
- **원인**: 주석 블록(`/*`)이 닫히지 않아 이후 코드가 주석 처리됨
- **수정**: 주석 블록을 닫는 `*/` 추가

```typescript
// 수정 전
/*
export type WizardData = {
  // ... 타입 정의
};

type ExtendedInitialData = Partial<WizardData> & {
  // ...

// 수정 후
/*
export type WizardData = {
  // ... 타입 정의
};
*/

type ExtendedInitialData = Partial<WizardData> & {
  // ...
```

## 수정된 파일 목록

1. `app/(student)/plan/new-group/_components/_features/basic-info/components/BlockSetSection.tsx`
2. `app/(student)/plan/new-group/_components/_features/basic-info/components/PeriodSection.tsx`
3. `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx`
4. `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useRecommendedContentSelection.ts`
5. `app/(student)/plan/new-group/_components/_features/content-selection/Step3Contents.tsx`
6. `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/Step4RecommendedContentsRefactored.tsx`
7. `app/(student)/plan/new-group/_components/_features/scheduling/Step2TimeSettings.tsx`
8. `app/(student)/plan/new-group/_components/_features/scheduling/components/TimeSettingsPanel.tsx`
9. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
10. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

## 검증

모든 TypeScript 에러가 해결되었는지 확인:

```bash
npx tsc --noEmit
```

결과: 에러 없음 (Exit code: 0)

## 참고사항

- 모든 import 경로는 실제 파일 구조에 맞게 수정되었습니다.
- 타입 정의는 기존 구조를 유지하면서 필요한 경우에만 수정했습니다.
- 주석 블록이 닫히지 않은 문제는 코드의 나머지 부분이 주석 처리되어 발생한 것으로, 주석 블록을 닫아 해결했습니다.
