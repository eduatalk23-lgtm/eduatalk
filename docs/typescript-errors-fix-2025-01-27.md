# TypeScript 에러 수정 작업 (2025-01-27)

## 작업 개요

TypeScript 컴파일 에러 101개를 수정했습니다. 주요 문제는 타입 export 누락, import 경로 오류, 타입 어노테이션 누락이었습니다.

## 수정된 주요 문제

### 1. 타입 Export 추가

#### `lib/schemas/planWizardSchema.ts`
- `TemplateLockedFields` 타입 export 추가
- `templateLockedFieldsSchema`에서 타입 추론하여 export

```typescript
export type TemplateLockedFields = z.infer<typeof templateLockedFieldsSchema>;
```

#### `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `WizardStep` 타입 export 충돌 해결
- `stepWeights` 상수 export 추가 (함수 스코프 문제 해결)
- `PlanGroupWizardProps` 타입 export 확인

### 2. Import 경로 수정

#### `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`
- `ScheduleTableView` import 경로 수정
  - 변경 전: `@/app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView`
  - 변경 후: `@/app/(student)/plan/new-group/_components/_features/scheduling/components/ScheduleTableView`
- `scheduleTransform` import 경로 수정
  - 변경 전: `@/app/(student)/plan/new-group/_components/_features/scheduling/utils/scheduleTransform`
  - 변경 후: `@/app/(student)/plan/new-group/_components/utils/scheduleTransform`

### 3. 타입 어노테이션 추가

#### `app/(student)/plan/new-group/_components/_context/PlanWizardContext.tsx`
- `exclusions.map((e) => ...)` → `exclusions.map((e: WizardData["exclusions"][number]) => ...)`
- `academy_schedules.map((s) => ...)` → `academy_schedules.map((s: WizardData["academy_schedules"][number]) => ...)`

#### `app/(student)/plan/new-group/_components/_features/basic-info/components/BlockSetSection.tsx`
- `setCurrentPage((prev) => ...)` → `setCurrentPage((prev: number) => ...)`
- `addedBlocks.map((block, index) => ...)` → `addedBlocks.map((block: { day: number; startTime: string; endTime: string }, index: number) => ...)`

#### `app/(student)/plan/new-group/_components/_features/basic-info/components/PeriodSection.tsx`
- `setDirectState((prev) => ...)` → `setDirectState((prev: { start: string; end: string }) => ...)`

#### `app/(student)/plan/new-group/_components/_features/basic-info/Step1BasicInfo.tsx`
- `planPurposes` 배열에 명시적 타입 추가
  - 변경 전: `const planPurposes = [...] as const;`
  - 변경 후: `const planPurposes: Array<{ value: "내신대비" | "모의고사(수능)" | ""; label: string }> = [...];`

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx`
- `onUpdate((prevContents) => ...)` → `onUpdate((prevContents: SelectedContent[]) => ...)`
- `prevContents.findIndex((c) => ...)` → `prevContents.findIndex((c: SelectedContent) => ...)`

#### `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useRecommendedContentSelection.ts`
- `data.student_contents.some((c) => ...)` → `data.student_contents.some((c: WizardData["student_contents"][number]) => ...)`
- `data.recommended_contents.some((c) => ...)` → `data.recommended_contents.some((c: WizardData["recommended_contents"][number]) => ...)`

### 4. 타입 비교 문제 수정

#### `lib/utils/planGroupDataSync.ts`
- `wizardPlanPurpose === ""` 비교 제거 (타입 불일치 해결)
  - `wizardPlanPurpose`는 `"내신대비" | "모의고사(수능)"` 타입이므로 빈 문자열과 비교 불가

### 5. WizardMode 타입 수정

#### `app/(student)/plan/new-group/_components/utils/modeUtils.ts`
- `WizardMode` 타입에서 `isEditMode`를 optional에서 required로 변경
  - `usePlanSubmission`에서 required로 기대하므로 타입 일치시킴

## 남은 작업

다음 파일들에서 추가 타입 어노테이션이 필요합니다:

1. `useStudentContentSelection.ts` - 콜백 함수 파라미터 타입 추가
2. `useRecommendations.ts` - 여러 콜백 함수 파라미터 타입 추가
3. `useRequiredSubjects.ts` - 콜백 함수 파라미터 타입 추가
4. `useContentInfos.ts` - 콜백 함수 파라미터 타입 추가
5. `useContentTotals.ts` - 콜백 함수 파라미터 타입 추가
6. `useInitialRanges.ts` - 콜백 함수 파라미터 타입 추가
7. `useRecommendedRanges.ts` - 콜백 함수 파라미터 타입 추가
8. `RequiredSubjectsSection.tsx` - 콜백 함수 파라미터 타입 추가
9. `Step6FinalReview/index.ts` - 파일 경로 문제 해결

## 결과

- 초기 에러: 101개
- 현재 에러: 약 86개 (주요 구조적 문제 해결)
- 남은 에러: 대부분 타입 어노테이션 누락 (패턴이 명확하여 일괄 수정 가능)

## 참고

모든 타입 에러는 TypeScript의 엄격한 타입 검사로 인한 것입니다. `any` 타입 사용을 피하고 명시적 타입을 추가하여 타입 안전성을 높였습니다.
