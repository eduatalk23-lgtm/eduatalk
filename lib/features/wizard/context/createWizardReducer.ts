/**
 * Wizard Reducer Factory
 *
 * 4-Layer Context 패턴을 위한 통합 리듀서 생성
 *
 * @module lib/features/wizard/context/createWizardReducer
 */

import type { BaseWizardData, WizardAction, WizardConfig, WizardState, WizardStep } from "../types";

// ============================================
// Reducer Factory
// ============================================

/**
 * 위자드 리듀서 생성
 *
 * @param config 위자드 설정
 * @param initialData 초기 데이터 생성 함수
 * @returns 타입 안전한 리듀서
 */
export function createWizardReducer<TData extends BaseWizardData>(
  config: WizardConfig,
  createInitialData: () => TData
) {
  const initialData = createInitialData();

  /**
   * 초기 상태 생성
   */
  function createInitialState(
    overrides?: Partial<TData>,
    initialStep?: WizardStep,
    initialDraftId?: string | null
  ): WizardState<TData> {
    const wizardData = overrides
      ? { ...initialData, ...overrides }
      : initialData;

    return {
      wizardData,
      initialWizardData: wizardData,
      currentStep: initialStep ?? 1,
      validationErrors: [],
      validationWarnings: [],
      fieldErrors: new Map(),
      draftGroupId: initialDraftId ?? null,
      createdGroupId: null,
      isSubmitting: false,
      isDirty: false,
      error: null,
    };
  }

  /**
   * 리듀서 함수
   */
  function reducer(
    state: WizardState<TData>,
    action: WizardAction<TData>
  ): WizardState<TData> {
    switch (action.type) {
      // ============================================
      // Data Actions
      // ============================================

      case "UPDATE_DATA":
        return {
          ...state,
          wizardData: { ...state.wizardData, ...action.payload },
          isDirty: true,
          error: null,
        };

      case "UPDATE_DATA_FN": {
        const updates = action.payload(state.wizardData);
        return {
          ...state,
          wizardData: { ...state.wizardData, ...updates },
          isDirty: true,
          error: null,
        };
      }

      case "SET_DRAFT_ID":
        return {
          ...state,
          draftGroupId: action.payload,
        };

      case "SET_CREATED_GROUP_ID":
        return {
          ...state,
          createdGroupId: action.payload,
        };

      case "SET_SUBMITTING":
        return {
          ...state,
          isSubmitting: action.payload,
        };

      case "SET_ERROR":
        return {
          ...state,
          error: action.payload,
          isSubmitting: false,
        };

      case "RESET_DIRTY_STATE":
        return {
          ...state,
          initialWizardData: state.wizardData,
          isDirty: false,
        };

      case "RESET":
        return createInitialState();

      // ============================================
      // Step Actions
      // ============================================

      case "NEXT_STEP": {
        const nextStep = Math.min(
          state.currentStep + 1,
          config.totalSteps
        ) as WizardStep;
        return {
          ...state,
          currentStep: nextStep,
        };
      }

      case "PREV_STEP": {
        const prevStep = Math.max(state.currentStep - 1, 1) as WizardStep;
        return {
          ...state,
          currentStep: prevStep,
        };
      }

      case "SET_STEP":
        return {
          ...state,
          currentStep: action.payload,
        };

      // ============================================
      // Validation Actions
      // ============================================

      case "SET_ERRORS":
        return {
          ...state,
          validationErrors: action.payload,
        };

      case "SET_WARNINGS":
        return {
          ...state,
          validationWarnings: action.payload,
        };

      case "SET_FIELD_ERROR": {
        const newFieldErrors = new Map(state.fieldErrors);
        newFieldErrors.set(action.payload.field, action.payload.error);
        return {
          ...state,
          fieldErrors: newFieldErrors,
        };
      }

      case "SET_FIELD_ERRORS":
        return {
          ...state,
          fieldErrors: action.payload,
        };

      case "CLEAR_FIELD_ERROR": {
        const newFieldErrors = new Map(state.fieldErrors);
        newFieldErrors.delete(action.payload);
        return {
          ...state,
          fieldErrors: newFieldErrors,
        };
      }

      case "CLEAR_VALIDATION":
        return {
          ...state,
          validationErrors: [],
          validationWarnings: [],
          fieldErrors: new Map(),
        };

      default:
        return state;
    }
  }

  return {
    reducer,
    createInitialState,
    initialData,
  };
}
