/**
 * 위저드 모드 관련 유틸리티 함수
 * 
 * 위저드의 다양한 모드(isCampMode, isTemplateMode, isAdminMode, isAdminContinueMode)를
 * 통합 관리하고 체크하는 헬퍼 함수들을 제공합니다.
 */

/**
 * 위저드 모드 타입 정의
 */
export type WizardMode = {
  isCampMode: boolean;
  isTemplateMode: boolean;
  isAdminMode: boolean;
  isAdminContinueMode: boolean;
  isEditMode: boolean;
};

/**
 * 위저드 모드 props 타입
 */
export type WizardModeProps = {
  isCampMode?: boolean;
  isTemplateMode?: boolean;
  isAdminMode?: boolean;
  isAdminContinueMode?: boolean;
  isEditMode?: boolean;
};

/**
 * 모드 props를 WizardMode 객체로 변환
 */
export function createWizardMode(props: WizardModeProps): WizardMode {
  return {
    isCampMode: props.isCampMode ?? false,
    isTemplateMode: props.isTemplateMode ?? false,
    isAdminMode: props.isAdminMode ?? false,
    isAdminContinueMode: props.isAdminContinueMode ?? false,
    isEditMode: props.isEditMode ?? false,
  };
}

/**
 * 관리자 모드인지 확인
 */
export function isAdminMode(mode: WizardMode): boolean {
  return mode.isAdminMode || mode.isAdminContinueMode;
}

/**
 * 학생 모드인지 확인 (일반 모드)
 */
export function isStudentMode(mode: WizardMode): boolean {
  return !mode.isCampMode && !mode.isTemplateMode && !isAdminMode(mode);
}

/**
 * 편집 가능한지 확인
 * 
 * @param mode 위저드 모드
 * @param additionalCondition 추가 조건 (예: 필드 잠금 여부)
 */
export function isEditable(mode: WizardMode, additionalCondition: boolean = false): boolean {
  // 관리자 continue 모드에서는 특정 단계만 편집 가능
  if (mode.isAdminContinueMode) {
    return !additionalCondition;
  }
  return !additionalCondition;
}

/**
 * 템플릿 모드에서 특정 단계를 건너뛰는지 확인
 */
export function shouldSkipStep(step: number, mode: WizardMode): boolean {
  if (mode.isTemplateMode) {
    // 템플릿 모드는 Step 5, 6, 7을 건너뜀
    return step === 5 || step === 6 || step === 7;
  }
  return false;
}

/**
 * 마지막 단계인지 확인
 */
export function isLastStep(currentStep: number, mode: WizardMode): boolean {
  if (mode.isTemplateMode) {
    return currentStep === 4; // 템플릿 모드는 Step 4가 마지막
  }
  if (mode.isCampMode && !mode.isAdminContinueMode) {
    return currentStep === 4; // 캠프 모드 (학생)는 Step 4가 마지막
  }
  return currentStep === 7; // 일반 모드와 캠프 모드 (관리자)는 Step 7이 마지막
}

/**
 * Step 4에서 제출해야 하는지 확인
 */
export function shouldSubmitAtStep4(mode: WizardMode): boolean {
  // 템플릿 모드나 캠프 모드(학생)에서 Step 4에서 제출
  return (mode.isTemplateMode || (mode.isCampMode && !mode.isAdminContinueMode));
}

/**
 * Step 5, 6에서 플랜 생성 없이 저장만 하는지 확인
 */
export function shouldSaveOnlyWithoutPlanGeneration(mode: WizardMode): boolean {
  return mode.isAdminContinueMode;
}

/**
 * 캠프 모드에서 콘텐츠 검증을 건너뛰는지 확인
 */
export function shouldSkipContentValidation(mode: WizardMode, currentStep: number): boolean {
  return mode.isCampMode && currentStep === 4 && !mode.isAdminContinueMode;
}

/**
 * 뒤로가기 가능한지 확인
 */
export function canGoBack(currentStep: number, mode: WizardMode): boolean {
  if (currentStep === 1) return false;
  
  // 관리자 continue 모드는 Step 4부터 시작하므로 Step 4 이상에서만 뒤로가기 가능
  if (mode.isAdminContinueMode) {
    return currentStep > 4;
  }
  
  return true;
}

/**
 * 특정 단계로 이동 가능한지 확인
 */
export function canNavigateToStep(targetStep: number, mode: WizardMode): boolean {
  // 관리자 continue 모드는 Step 4부터 시작
  if (mode.isAdminContinueMode && targetStep < 4) {
    return false;
  }
  
  // 템플릿 모드는 Step 1-4만 가능
  if (mode.isTemplateMode && targetStep > 4) {
    return false;
  }
  
  return true;
}

