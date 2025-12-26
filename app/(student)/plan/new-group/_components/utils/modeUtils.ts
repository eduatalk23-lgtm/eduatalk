/**
 * 위저드 모드 관련 유틸리티 함수
 *
 * 위저드의 다양한 모드(isCampMode, isTemplateMode, isAdminMode, isAdminContinueMode)를
 * 통합 관리하고 체크하는 헬퍼 함수들을 제공합니다.
 */

import {
  WIZARD_STEPS,
  TEMPLATE_MODE_LAST_STEP,
  CAMP_MODE_STUDENT_LAST_STEP,
  isTemplateExcludedStep,
} from "../constants/wizardConstants";

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
    // 템플릿 모드에서 제외되는 단계 확인
    return isTemplateExcludedStep(step);
  }
  return false;
}

/**
 * 마지막 단계인지 확인
 */
export function isLastStep(currentStep: number, mode: WizardMode): boolean {
  if (mode.isTemplateMode) {
    return currentStep === TEMPLATE_MODE_LAST_STEP;
  }
  if (mode.isCampMode && !mode.isAdminContinueMode) {
    return currentStep === CAMP_MODE_STUDENT_LAST_STEP;
  }
  return currentStep === WIZARD_STEPS.RESULT;
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
  return mode.isCampMode && currentStep === WIZARD_STEPS.CONTENT_SELECTION && !mode.isAdminContinueMode;
}

/**
 * 뒤로가기 가능한지 확인
 */
export function canGoBack(currentStep: number, mode: WizardMode): boolean {
  if (currentStep === WIZARD_STEPS.BASIC_INFO) return false;

  // 관리자 continue 모드에서도 이전 단계로 돌아갈 수 있도록 허용
  // (읽기 전용으로 학생 제출 내용 확인 용도)

  return true;
}

/**
 * 특정 단계로 이동 가능한지 확인
 */
export function canNavigateToStep(targetStep: number, mode: WizardMode): boolean {
  // 관리자 continue 모드에서도 모든 단계로 이동 가능 (읽기 전용으로 확인 용도)
  // Step 1-4는 읽기 전용으로 표시됨

  // 템플릿 모드는 Step 1-4만 가능
  if (mode.isTemplateMode && targetStep > TEMPLATE_MODE_LAST_STEP) {
    return false;
  }

  return true;
}

/**
 * 특정 단계가 읽기 전용인지 확인
 * 관리자 continue 모드에서 Step 1-4는 읽기 전용
 */
export function isStepReadOnly(step: number, mode: WizardMode): boolean {
  if (mode.isAdminContinueMode && step < WIZARD_STEPS.RECOMMENDED_CONTENT) {
    return true;
  }
  return false;
}

/**
 * 관리자 continue 모드에서 편집 가능한 첫 번째 단계
 */
export function getFirstEditableStep(mode: WizardMode): number {
  if (mode.isAdminContinueMode) {
    return WIZARD_STEPS.RECOMMENDED_CONTENT; // Step 5부터 편집 가능
  }
  return WIZARD_STEPS.BASIC_INFO;
}

