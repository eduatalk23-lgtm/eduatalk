/**
 * dataReducer - 데이터 상태 리듀서
 *
 * Phase 3 코드 구조 개선: 리듀서 분리
 * 위저드 데이터 관련 액션만 처리합니다.
 */

import type { WizardData } from "../../PlanGroupWizard";
import { hasWizardDataChanged } from "../../utils/wizardDataComparison";

/**
 * 데이터 상태 타입
 */
export type DataState = {
  wizardData: WizardData;
  initialWizardData: WizardData;
  draftGroupId: string | null;
  isDirty: boolean;
  isSubmitting: boolean;
};

/**
 * 데이터 액션 타입
 */
export type DataAction =
  | { type: "UPDATE_DATA"; payload: Partial<WizardData> }
  | { type: "UPDATE_DATA_FN"; payload: (prev: WizardData) => Partial<WizardData> }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "RESET_DIRTY_STATE" };

/**
 * 데이터 리듀서
 *
 * @param state 현재 데이터 상태
 * @param action 데이터 액션
 * @returns 새로운 데이터 상태
 */
export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "UPDATE_DATA": {
      const newWizardData = { ...state.wizardData, ...action.payload };
      const isDirty = hasWizardDataChanged(state.initialWizardData, newWizardData);
      return {
        ...state,
        wizardData: newWizardData,
        isDirty,
      };
    }
    case "UPDATE_DATA_FN": {
      const newWizardData = { ...state.wizardData, ...action.payload(state.wizardData) };
      const isDirty = hasWizardDataChanged(state.initialWizardData, newWizardData);
      return {
        ...state,
        wizardData: newWizardData,
        isDirty,
      };
    }
    case "SET_DRAFT_ID":
      return {
        ...state,
        draftGroupId: action.payload,
      };
    case "SET_SUBMITTING":
      return {
        ...state,
        isSubmitting: action.payload,
      };
    case "RESET_DIRTY_STATE":
      // 저장 후 초기 데이터를 현재 데이터로 업데이트하여 dirty 상태 리셋
      return {
        ...state,
        initialWizardData: { ...state.wizardData },
        isDirty: false,
      };
    default:
      return state;
  }
}

/**
 * 데이터 액션 타입 체크 헬퍼
 */
export function isDataAction(action: { type: string }): action is DataAction {
  return [
    "UPDATE_DATA",
    "UPDATE_DATA_FN",
    "SET_DRAFT_ID",
    "SET_SUBMITTING",
    "RESET_DIRTY_STATE",
  ].includes(action.type);
}
