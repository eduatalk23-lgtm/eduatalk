# TypeScript 에러 수정 작업 Phase 2 (2025-01-27)

## 작업 개요

Phase 1에서 해결한 주요 구조적 문제 이후, 남은 TypeScript 에러들을 추가로 수정했습니다.

## 수정된 주요 문제

### 1. Import 경로 수정

#### `scheduleTransform` 경로 수정
- `scheduling/components` 폴더의 모든 파일에서 `../../utils/scheduleTransform` → `../../../utils/scheduleTransform`으로 수정
- `Step7ScheduleResult.tsx`에서 `../../../utils/scheduleTransform` → `../../utils/scheduleTransform`으로 수정

#### `PlanGroupWizard` import 경로 통일
- 모든 파일에서 상대 경로를 절대 경로로 변경
- `@/app/(student)/plan/new-group/_components/PlanGroupWizard`로 통일

### 2. 타입 어노테이션 추가

#### `useStudentContentSelection.ts`
- `data.student_contents.filter((c) => ...)` → `data.student_contents.filter((c: WizardData["student_contents"][number]) => ...)`
- `data.student_contents.some((c) => ...)` → `data.student_contents.some((c: WizardData["student_contents"][number]) => ...)`
- `data.student_contents.filter((_, i) => ...)` → `data.student_contents.filter((_: WizardData["student_contents"][number], i: number) => ...)`

#### `useRecommendations.ts`
- 모든 콜백 함수 파라미터에 타입 추가
- `data.student_contents.forEach((c) => ...)` → `data.student_contents.forEach((c: WizardData["student_contents"][number]) => ...)`
- `data.recommended_contents.forEach((c) => ...)` → `data.recommended_contents.forEach((c: WizardData["recommended_contents"][number]) => ...)`
- `onUpdate((prev) => ...)` → `onUpdate((prev: WizardData) => ...)`

#### `useRequiredSubjects.ts`
- 모든 콜백 함수 파라미터에 타입 추가
- `data.student_contents.forEach((sc) => ...)` → `data.student_contents.forEach((sc: WizardData["student_contents"][number]) => ...)`
- `data.recommended_contents.forEach((rc) => ...)` → `data.recommended_contents.forEach((rc: WizardData["recommended_contents"][number]) => ...)`

#### `RequiredSubjectsSection.tsx`
- 복잡한 타입 인덱싱 대신 간단한 타입 추론 사용
- `data.subject_constraints?.required_subjects?.forEach((req: NonNullable<...>) => ...)` → `const requiredSubjects = data.subject_constraints?.required_subjects || []; requiredSubjects.forEach((req) => ...)`

### 3. 타입 불일치 수정

#### `Step2TimeSettings.tsx`
- `onNavigateToStep?: (step: number) => void` → `onNavigateToStep?: (step: WizardStep) => void`
- `WizardStep` 타입 import 추가

#### `Step6FinalReview/index.ts`
- `./Step6FinalReview` → `../Step6FinalReview` (상위 디렉토리로 경로 수정)

### 4. 남은 문제

다음 문제들은 추가 조사가 필요합니다:

1. **`stepWeights`와 `PlanGroupWizardProps` 스코프 문제**
   - `stepWeights`는 `export const`로 선언되어 있지만 함수 내부에서 접근 불가
   - `PlanGroupWizardProps`는 `export type`으로 선언되어 있지만 함수 파라미터에서 사용 불가
   - 타입스크립트 캐시 문제일 가능성 (tsconfig.tsbuildinfo 삭제 후 재시도 필요)

2. **여러 import 경로 문제**
   - `useBlockSetManagement`, `usePeriodCalculation`, `useWizardValidation` 등의 상대 경로 문제
   - `useRecommendedContentSelection.ts`의 `../types`, `../constants` 모듈 찾기 실패
   - `Step3Contents.tsx`의 `./hooks/useContentSelection` 모듈 찾기 실패

3. **`StudentContentsPanel.tsx` 타입 불일치**
   - `onUpdate`가 함수를 받지 않고 배열만 받도록 타입이 정의되어 있음
   - 타입 정의 수정 필요

## 결과

- Phase 1 후 에러: 약 86개
- Phase 2 후 에러: 약 17개
- 주요 개선: import 경로 통일, 타입 어노테이션 추가

## 다음 단계

1. 타입스크립트 캐시 삭제 후 재컴파일
2. 남은 import 경로 문제 해결
3. `StudentContentsPanel.tsx` 타입 정의 수정
4. `stepWeights`와 `PlanGroupWizardProps` 스코프 문제 재확인

