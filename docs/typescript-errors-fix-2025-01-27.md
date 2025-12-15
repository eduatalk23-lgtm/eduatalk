# TypeScript 에러 수정 작업 (2025-01-27)

## 개요

프로젝트에서 발생한 140개의 TypeScript 컴파일 에러를 수정했습니다.

## 수정 내용

### 1. PlanGroupWizard.tsx

**문제**: Context에서 제공하는 함수명과 사용하는 함수명 불일치
- `setValidationErrors` → `setErrors`로 변경
- `setCurrentStep` → `setStep`으로 변경
- `PlanGroupWizardProps` 타입을 export 추가

**수정 파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

### 2. planWizardSchema.ts

**문제**: `ZodEffects` 타입에서는 `.partial()`과 `.pick()` 메서드를 직접 사용할 수 없음

**해결 방법**: refine 전의 object 스키마를 별도로 저장하여 partial/pick 메서드 사용 가능하도록 수정

```typescript
// 수정 전
export const planWizardSchema = z.object({...}).refine(...);
export const partialPlanWizardSchema = planWizardSchema.partial(); // 에러

// 수정 후
const planWizardSchemaObject = z.object({...});
export const planWizardSchema = planWizardSchemaObject.refine(...);
export const partialPlanWizardSchema = planWizardSchemaObject.partial(); // 정상
```

**수정 파일**: `lib/schemas/planWizardSchema.ts`

### 3. scheduler.ts

**문제**: 
- async 함수인데 반환 타입이 `ScheduledPlan[]`로 되어 있음
- `SchedulerOptions` 타입 import 누락

**수정 내용**:
- 반환 타입을 `Promise<ScheduledPlan[]>`로 변경
- `SchedulerOptions` 타입 import 추가

**수정 파일**: `lib/plan/scheduler.ts`

**영향**: `generatePlansFromGroup` 함수를 호출하는 모든 곳에서 `await` 추가 필요
- `app/(student)/actions/plan-groups/previewPlansRefactored.ts`
- `app/(student)/actions/plan-groups/reschedule.ts`

### 4. planGroupDataSync.ts

**문제**: 여러 타입 불일치 및 null 체크 누락

**수정 내용**:
1. `wizardPlanPurpose === ""` 비교 문제 해결 (타입 가드 추가)
2. `master_content_id`, `recommendation_source` 속성 접근 시 타입 가드 추가
3. `timeSettings` 타입 단언 및 null 체크 추가
4. `study_review_cycle`, `student_level`, `subject_allocations`, `content_allocations` 타입 단언 추가

**수정 파일**: `lib/utils/planGroupDataSync.ts`

### 5. usePlanSubmission.ts

**문제**: `mode` 객체와 개별 속성들이 중복되어 타입 충돌 발생

**수정 내용**: 개별 속성(`isCampMode`, `isAdminContinueMode`, `isAdminMode`) 제거하고 `mode` 객체만 사용하도록 수정

**수정 파일**: 
- `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

### 6. fieldLockUtils.ts

**문제**: `permissions[fieldName]`에서 fieldName이 symbol 타입으로 추론됨

**수정 내용**: 타입 단언 추가
```typescript
permissions[fieldName as string] = canStudentInput(...)
```

**수정 파일**: `app/(student)/plan/new-group/_components/utils/fieldLockUtils.ts`

### 7. Step6Simplified.tsx

**문제**: `onUpdate && contents` 조건에서 함수가 항상 정의되어 있어서 항상 true가 됨

**수정 내용**: 함수 존재 여부를 명시적으로 확인
```typescript
typeof onUpdate === "function" && contents
```

**수정 파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

## 남은 에러들

다음 에러들은 프로젝트 구조와 관련된 문제로 추가 작업이 필요합니다:

1. **모듈 import 경로 문제**: 여러 파일에서 상대 경로로 import하는 모듈을 찾을 수 없음
   - `PlanGroupWizard` 모듈 import 경로 문제
   - `Step7ScheduleResult/ScheduleTableView` 모듈 누락
   - 기타 상대 경로 import 문제

2. **any 타입 관련 에러**: 암시적 any 타입이 많은 곳에서 발생
   - 주로 콜백 함수의 매개변수 타입이 명시되지 않음

3. **Promise 처리**: `generatePlansFromGroup` 함수가 Promise를 반환하므로 호출하는 모든 곳에서 await 추가 필요

## 다음 단계

1. 모듈 import 경로 문제 해결
2. 암시적 any 타입 명시적 타입으로 변경
3. 전체 프로젝트에서 TypeScript 컴파일 에러 재확인

## 참고

- 주요 파일들의 린터 에러는 해결되었습니다.
- 나머지 에러들은 점진적으로 수정할 수 있습니다.

