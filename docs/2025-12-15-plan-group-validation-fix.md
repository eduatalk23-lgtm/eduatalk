# 플랜 그룹 검증 및 페이지 이동 기능 수정

## 작업 일자
2025-12-15

## 문제점

### 핵심 문제
1. **상태 동기화 실패**: `useWizardValidation` 훅이 로컬 상태(`useState`)로 `fieldErrors`를 관리하지만, `PlanGroupWizard`는 Context의 `fieldErrors`를 사용하여 검증 오류가 UI에 표시되지 않음
2. **중복된 검증 로직**: `usePlanValidator`와 `useWizardValidation`이 유사한 기능을 중복 제공하는 것으로 보였으나, 실제로는 역할이 명확히 분리되어 있음
3. **검증 로직 분산**: 검증 로직이 `validationUtils.ts`, `wizardValidator.ts`, `planValidator.ts`에 분산되어 있으나, 각각의 역할이 명확함

## 해결 방안

### 1. useWizardValidation 훅 수정

**파일**: `app/(student)/plan/new-group/_components/hooks/useWizardValidation.ts`

**변경 사항**:
- Context의 `setFieldError`, `setErrors`, `setWarnings`, `clearValidation` 함수를 props로 받아서 사용
- `validateStep` 함수가 검증 결과를 Context에 직접 반영하도록 수정
- Context 업데이트 순서: `clearValidation` → `setErrors` → `setWarnings` → `setFieldError`
- 로컬 상태는 하위 호환성을 위해 유지하되, Context 업데이트를 우선시

**주요 변경 코드**:
```typescript
type UseWizardValidationProps = {
  wizardData: WizardData;
  isTemplateMode: boolean;
  isCampMode?: boolean;
  // Context 함수들 (옵셔널 - 하위 호환성 유지)
  setFieldError?: (field: string, error: string) => void;
  setErrors?: (errors: string[]) => void;
  setWarnings?: (warnings: string[]) => void;
  clearValidation?: () => void;
};

const validateStep = useCallback((step: WizardStep): boolean => {
  const result = validateStepUtil(wizardData, step, isTemplateMode, isCampMode);
  
  // Context 업데이트 (우선) - 검증 결과를 Context에 반영
  if (clearValidation) {
    clearValidation(); // 기존 검증 상태 먼저 초기화
  }
  if (setErrors) {
    setErrors(result.errors);
  }
  if (setWarnings) {
    setWarnings(result.warnings);
  }
  if (setFieldError) {
    result.fieldErrors.forEach((error, field) => {
      setFieldError(field, error);
    });
  }
  
  // 로컬 상태 업데이트 (하위 호환성 유지)
  setValidationErrors(result.errors);
  setValidationWarnings(result.warnings);
  setFieldErrors(result.fieldErrors);
  
  return result.isValid;
}, [wizardData, isTemplateMode, isCampMode, setFieldError, setErrors, setWarnings, clearValidation]);
```

### 2. PlanGroupWizard에서 Context 함수 전달

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 사항**:
- `useWizardValidation` 호출 시 Context 함수들을 props로 전달

**주요 변경 코드**:
```typescript
const {
  validateStep,
  clearValidationState
} = useWizardValidation({
  wizardData,
  isTemplateMode,
  isCampMode,
  // Context 함수들 전달 - 검증 결과를 Context에 반영
  setFieldError,
  setErrors,
  setWarnings,
  clearValidation,
});
```

### 3. 검증 훅 역할 명확화

**usePlanValidator** (제출용):
- `usePlanSubmission`에서만 사용
- 상태 관리 없이 검증 결과만 반환
- 주로 `validatePeriod` 함수 제공

**useWizardValidation** (UI용):
- `PlanGroupWizard`에서 사용
- Context를 통한 검증 상태 관리
- 검증 오류를 UI에 표시하는 역할

두 훅 모두 `validateStepUtil`을 사용하므로 중복 없음.

## 검증 흐름

### 개선된 흐름
1. `handleNext` → `validateStep` 호출
2. `validateStep` → Context 업데이트 (우선) + 로컬 상태 업데이트 (하위 호환)
3. Context의 `fieldErrors` 업데이트됨
4. Step 컴포넌트가 Context의 `fieldErrors`를 사용하여 오류 표시
5. 검증 실패 시 `shouldScrollToErrorRef` 플래그 설정
6. `useEffect`에서 `fieldErrors` 변경 감지 후 첫 번째 오류 필드로 스크롤

### 검증 단계별 로직

**Step 1 검증**:
- 필수 필드 검증 (`validateRequiredFields`)
- 기간 검증 (`validatePeriod`)
- 필드별 오류: `plan_name`, `plan_purpose`, `period_start`, `scheduler_type`

**Step 4 검증**:
- 콘텐츠 선택 검증 (`validateContents`)
- 필드별 오류: `content_selection`

## 테스트 항목

1. **Step 1 검증 테스트**:
   - 필수 필드 미입력 시 오류 메시지 표시
   - 기간 미입력 시 오류 메시지 표시
   - 검증 실패 시 페이지 이동 차단

2. **Step 4 검증 테스트**:
   - 콘텐츠 미선택 시 오류 메시지 표시
   - 검증 실패 시 페이지 이동 차단

3. **페이지 이동 테스트**:
   - 검증 성공 시 다음 단계로 이동
   - 검증 실패 시 현재 단계 유지

4. **오류 메시지 표시 테스트**:
   - 필드별 오류 메시지가 정확히 표시되는지 확인
   - 첫 번째 오류 필드로 자동 스크롤되는지 확인

## 예상 효과

1. **검증 오류 표시**: Context 기반 상태 관리로 검증 오류가 UI에 정확히 표시됨
2. **코드 일관성**: Context를 통한 단일 상태 관리로 일관성 향상
3. **유지보수성**: 검증 로직이 명확하게 분리되어 유지보수 용이
4. **성능**: 불필요한 중복 검증 제거

## 주의 사항

1. **하위 호환성**: `useWizardValidation`의 로컬 상태는 하위 호환성을 위해 유지
2. **Context 업데이트 순서**: `clearValidation` → `setErrors` → `setWarnings` → `setFieldError` 순서로 업데이트하여 기존 오류가 남지 않도록 주의
3. **테스트 범위**: 모든 Step의 검증 로직과 페이지 이동 로직을 테스트해야 함

## 관련 파일

- `app/(student)/plan/new-group/_components/hooks/useWizardValidation.ts`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/new-group/_components/hooks/usePlanValidator.ts`
- `app/(student)/plan/new-group/_components/utils/validationUtils.ts`
- `app/(student)/plan/new-group/_components/_context/PlanWizardContext.tsx`

