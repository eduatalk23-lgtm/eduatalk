/**
 * stepReducer - 단계 상태 리듀서
 *
 * Phase 3 코드 구조 개선: 리듀서 분리
 * 위저드 네비게이션 관련 액션만 처리합니다.
 */

import type { WizardStep } from "../../PlanGroupWizard";
import { WIZARD_STEPS, TOTAL_STEPS } from "../../constants/wizardConstants";

/**
 * 단계 상태 타입
 */
export type StepState = {
  currentStep: WizardStep;
};

/**
 * 단계 액션 타입
 */
export type StepAction =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_STEP"; payload: WizardStep };

/**
 * 단계 리듀서
 *
 * @param state 현재 단계 상태
 * @param action 단계 액션
 * @returns 새로운 단계 상태
 */
export function stepReducer(state: StepState, action: StepAction): StepState {
  switch (action.type) {
    case "NEXT_STEP":
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS) as WizardStep,
      };
    case "PREV_STEP":
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, WIZARD_STEPS.BASIC_INFO) as WizardStep,
      };
    case "SET_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };
    default:
      return state;
  }
}

/**
 * 단계 액션 타입 체크 헬퍼
 */
export function isStepAction(action: { type: string }): action is StepAction {
  return ["NEXT_STEP", "PREV_STEP", "SET_STEP"].includes(action.type);
}
