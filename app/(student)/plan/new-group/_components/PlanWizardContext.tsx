"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type { WizardData, WizardStep } from "./PlanGroupWizard";

/**
 * Wizard 상태 타입
 */
export type WizardState = {
  wizardData: WizardData;
  currentStep: WizardStep;
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;
  draftGroupId: string | null;
  isSubmitting: boolean;
};

/**
 * Wizard 액션 타입
 */
export type WizardAction =
  | { type: "UPDATE_DATA"; payload: Partial<WizardData> }
  | { type: "UPDATE_DATA_FN"; payload: (prev: WizardData) => Partial<WizardData> }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_STEP"; payload: WizardStep }
  | { type: "SET_ERRORS"; payload: string[] }
  | { type: "SET_WARNINGS"; payload: string[] }
  | { type: "SET_FIELD_ERROR"; payload: { field: string; error: string } }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "CLEAR_VALIDATION" }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "SET_SUBMITTING"; payload: boolean };

/**
 * Wizard Reducer
 */
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "UPDATE_DATA":
      return {
        ...state,
        wizardData: { ...state.wizardData, ...action.payload },
        validationErrors: [],
        validationWarnings: [],
      };
    case "UPDATE_DATA_FN":
      return {
        ...state,
        wizardData: { ...state.wizardData, ...action.payload(state.wizardData) },
        validationErrors: [],
        validationWarnings: [],
      };
    case "NEXT_STEP":
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, 7) as WizardStep,
      };
    case "PREV_STEP":
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 1) as WizardStep,
      };
    case "SET_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };
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
    case "SET_FIELD_ERROR":
      const newFieldErrors = new Map(state.fieldErrors);
      newFieldErrors.set(action.payload.field, action.payload.error);
      return {
        ...state,
        fieldErrors: newFieldErrors,
      };
    case "CLEAR_FIELD_ERROR":
      const clearedFieldErrors = new Map(state.fieldErrors);
      clearedFieldErrors.delete(action.payload);
      return {
        ...state,
        fieldErrors: clearedFieldErrors,
      };
    case "CLEAR_VALIDATION":
      return {
        ...state,
        validationErrors: [],
        validationWarnings: [],
        fieldErrors: new Map(),
      };
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
    default:
      return state;
  }
}

/**
 * 초기 상태 생성 함수
 */
function createInitialState(initialData?: Partial<WizardData>): WizardState {
  const defaultWizardData: WizardData = {
    name: "",
    plan_purpose: "",
    scheduler_type: "",
    period_start: "",
    period_end: "",
    block_set_id: "",
    exclusions: [],
    academy_schedules: [],
    student_contents: [],
    recommended_contents: [],
    ...initialData,
  };

  return {
    wizardData: defaultWizardData,
    currentStep: 1,
    validationErrors: [],
    validationWarnings: [],
    fieldErrors: new Map(),
    draftGroupId: null,
    isSubmitting: false,
  };
}

/**
 * Wizard Context 타입
 */
type PlanWizardContextType = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  // 유틸리티 함수들
  updateData: (updates: Partial<WizardData>) => void;
  updateDataFn: (fn: (prev: WizardData) => Partial<WizardData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: WizardStep) => void;
  setErrors: (errors: string[]) => void;
  setWarnings: (warnings: string[]) => void;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  clearValidation: () => void;
  setDraftId: (id: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
};

const PlanWizardContext = createContext<PlanWizardContextType | null>(null);

/**
 * PlanWizardProvider Props
 */
type PlanWizardProviderProps = {
  children: ReactNode;
  initialData?: Partial<WizardData>;
  initialStep?: WizardStep;
  initialDraftId?: string | null;
};

/**
 * PlanWizardProvider
 * 
 * Plan Wizard의 상태를 관리하는 Context Provider입니다.
 * useReducer를 사용하여 상태를 중앙화하고, Props Drilling을 제거합니다.
 */
export function PlanWizardProvider({
  children,
  initialData,
  initialStep = 1,
  initialDraftId = null,
}: PlanWizardProviderProps) {
  const initialState = createInitialState(initialData);
  if (initialStep !== 1) {
    initialState.currentStep = initialStep;
  }
  if (initialDraftId !== null) {
    initialState.draftGroupId = initialDraftId;
  }

  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // 유틸리티 함수들
  const updateData = useCallback((updates: Partial<WizardData>) => {
    dispatch({ type: "UPDATE_DATA", payload: updates });
  }, []);

  const updateDataFn = useCallback((fn: (prev: WizardData) => Partial<WizardData>) => {
    dispatch({ type: "UPDATE_DATA_FN", payload: fn });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: "NEXT_STEP" });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: "PREV_STEP" });
  }, []);

  const setStep = useCallback((step: WizardStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const setErrors = useCallback((errors: string[]) => {
    dispatch({ type: "SET_ERRORS", payload: errors });
  }, []);

  const setWarnings = useCallback((warnings: string[]) => {
    dispatch({ type: "SET_WARNINGS", payload: warnings });
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    dispatch({ type: "SET_FIELD_ERROR", payload: { field, error } });
  }, []);

  const clearFieldError = useCallback((field: string) => {
    dispatch({ type: "CLEAR_FIELD_ERROR", payload: field });
  }, []);

  const clearValidation = useCallback(() => {
    dispatch({ type: "CLEAR_VALIDATION" });
  }, []);

  const setDraftId = useCallback((id: string | null) => {
    dispatch({ type: "SET_DRAFT_ID", payload: id });
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    dispatch({ type: "SET_SUBMITTING", payload: isSubmitting });
  }, []);

  const value: PlanWizardContextType = {
    state,
    dispatch,
    updateData,
    updateDataFn,
    nextStep,
    prevStep,
    setStep,
    setErrors,
    setWarnings,
    setFieldError,
    clearFieldError,
    clearValidation,
    setDraftId,
    setSubmitting,
  };

  return (
    <PlanWizardContext.Provider value={value}>
      {children}
    </PlanWizardContext.Provider>
  );
}

/**
 * usePlanWizard Hook
 * 
 * PlanWizardContext를 사용하기 위한 커스텀 훅입니다.
 * Provider 외부에서 사용하면 에러를 발생시킵니다.
 */
export function usePlanWizard(): PlanWizardContextType {
  const context = useContext(PlanWizardContext);
  if (!context) {
    throw new Error("usePlanWizard must be used within PlanWizardProvider");
  }
  return context;
}

