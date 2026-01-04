"use client";

/**
 * Batch Wizard Context
 *
 * BatchAIPlanModal의 4-Layer Context Provider
 * 데이터, 스텝, 상태, 검증을 분리하여 불필요한 리렌더 방지
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/BatchWizardContext
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";

import type {
  BatchWizardState,
  BatchWizardAction,
  BatchModalStep,
  BatchDataContextValue,
  BatchStepContextValue,
  BatchStateContextValue,
  BatchValidationContextValue,
  CostEstimate,
  StudentContentInfo,
} from "./batchTypes";
import { createInitialBatchState } from "./batchTypes";
import { batchReducer } from "./batchReducer";

import type {
  BatchPlanSettings,
  StudentPlanResult,
  BatchPlanGenerationResult,
} from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";
import type { BatchPreviewResult } from "@/lib/domains/admin-plan/types/preview";

// ============================================
// Contexts
// ============================================

const BatchDataContext = createContext<BatchDataContextValue | null>(null);
const BatchStepContext = createContext<BatchStepContextValue | null>(null);
const BatchStateContext = createContext<BatchStateContextValue | null>(null);
const BatchValidationContext =
  createContext<BatchValidationContextValue | null>(null);

// Dispatch context for advanced usage
const BatchDispatchContext = createContext<React.Dispatch<
  BatchWizardAction
> | null>(null);

// ============================================
// Provider Props
// ============================================

interface BatchWizardProviderProps {
  children: ReactNode;
  initialSettings?: Partial<BatchPlanSettings>;
}

// ============================================
// Provider Component
// ============================================

export function BatchWizardProvider({
  children,
  initialSettings,
}: BatchWizardProviderProps) {
  // 초기 상태 생성
  const initialState = useMemo(() => {
    const state = createInitialBatchState();
    if (initialSettings) {
      state.data.settings = { ...state.data.settings, ...initialSettings };
    }
    return state;
  }, [initialSettings]);

  const [state, dispatch] = useReducer(batchReducer, initialState);

  // ============================================
  // Data Context Value
  // ============================================

  const dataContextValue = useMemo<BatchDataContextValue>(() => {
    const { data } = state;

    return {
      // Data
      settings: data.settings,
      estimatedCost: data.estimatedCost,
      progress: data.progress,
      currentStudent: data.currentStudent,
      results: data.results,
      finalResult: data.finalResult,
      previewResult: data.previewResult,
      selectedStudentIds: data.selectedStudentIds,
      previewStudents: data.previewStudents,
      retryMode: data.retryMode,
      selectedRetryIds: data.selectedRetryIds,
      originalContentsMap: data.originalContentsMap,

      // Actions
      updateSettings: (settings: Partial<BatchPlanSettings>) =>
        dispatch({ type: "UPDATE_SETTINGS", payload: settings }),
      setEstimatedCost: (cost: CostEstimate | null) =>
        dispatch({ type: "SET_ESTIMATED_COST", payload: cost }),
      setProgress: (progress: number) =>
        dispatch({ type: "SET_PROGRESS", payload: progress }),
      setCurrentStudent: (student: string) =>
        dispatch({ type: "SET_CURRENT_STUDENT", payload: student }),
      addResult: (result: StudentPlanResult) =>
        dispatch({ type: "ADD_RESULT", payload: result }),
      setResults: (results: StudentPlanResult[]) =>
        dispatch({ type: "SET_RESULTS", payload: results }),
      setFinalResult: (result: BatchPlanGenerationResult | null) =>
        dispatch({ type: "SET_FINAL_RESULT", payload: result }),
      setPreviewResult: (result: BatchPreviewResult | null) =>
        dispatch({ type: "SET_PREVIEW_RESULT", payload: result }),
      setSelectedStudentIds: (ids: string[]) =>
        dispatch({ type: "SET_SELECTED_STUDENT_IDS", payload: ids }),
      setPreviewStudents: (students: StudentContentInfo[]) =>
        dispatch({ type: "SET_PREVIEW_STUDENTS", payload: students }),
      setRetryMode: (mode: boolean) =>
        dispatch({ type: "SET_RETRY_MODE", payload: mode }),
      setSelectedRetryIds: (ids: string[]) =>
        dispatch({ type: "SET_SELECTED_RETRY_IDS", payload: ids }),
      setOriginalContentsMap: (map: Map<string, string[]>) =>
        dispatch({ type: "SET_ORIGINAL_CONTENTS_MAP", payload: map }),
    };
  }, [state.data]);

  // ============================================
  // Step Context Value
  // ============================================

  const stepContextValue = useMemo<BatchStepContextValue>(() => {
    return {
      currentStep: state.currentStep,
      setStep: (step: BatchModalStep) =>
        dispatch({ type: "SET_STEP", payload: step }),
      goToSettings: () => dispatch({ type: "GO_TO_SETTINGS" }),
      goToPreview: () => dispatch({ type: "GO_TO_PREVIEW" }),
      goToProgress: () => dispatch({ type: "GO_TO_PROGRESS" }),
      goToResults: () => dispatch({ type: "GO_TO_RESULTS" }),
      isSettingsStep: state.currentStep === "settings",
      isPreviewStep: state.currentStep === "preview",
      isProgressStep: state.currentStep === "progress",
      isResultsStep: state.currentStep === "results",
    };
  }, [state.currentStep]);

  // ============================================
  // State Context Value
  // ============================================

  const stateContextValue = useMemo<BatchStateContextValue>(() => {
    return {
      isLoading: state.isLoading,
      error: state.error,
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),
      setError: (error: string | null) =>
        dispatch({ type: "SET_ERROR", payload: error }),
      reset: () => dispatch({ type: "RESET" }),
    };
  }, [state.isLoading, state.error]);

  // ============================================
  // Validation Context Value
  // ============================================

  const validationContextValue = useMemo<BatchValidationContextValue>(() => {
    return {
      validationErrors: state.validationErrors,
      setValidationErrors: (errors: string[]) =>
        dispatch({ type: "SET_VALIDATION_ERRORS", payload: errors }),
      clearValidation: () => dispatch({ type: "CLEAR_VALIDATION" }),
      hasErrors: state.validationErrors.length > 0,
    };
  }, [state.validationErrors]);

  return (
    <BatchDispatchContext.Provider value={dispatch}>
      <BatchStateContext.Provider value={stateContextValue}>
        <BatchValidationContext.Provider value={validationContextValue}>
          <BatchStepContext.Provider value={stepContextValue}>
            <BatchDataContext.Provider value={dataContextValue}>
              {children}
            </BatchDataContext.Provider>
          </BatchStepContext.Provider>
        </BatchValidationContext.Provider>
      </BatchStateContext.Provider>
    </BatchDispatchContext.Provider>
  );
}

// ============================================
// Custom Hooks
// ============================================

/**
 * Batch 데이터 Context Hook
 */
export function useBatchData(): BatchDataContextValue {
  const context = useContext(BatchDataContext);
  if (!context) {
    throw new Error("useBatchData must be used within BatchWizardProvider");
  }
  return context;
}

/**
 * Batch 스텝 Context Hook
 */
export function useBatchStep(): BatchStepContextValue {
  const context = useContext(BatchStepContext);
  if (!context) {
    throw new Error("useBatchStep must be used within BatchWizardProvider");
  }
  return context;
}

/**
 * Batch 상태 Context Hook
 */
export function useBatchState(): BatchStateContextValue {
  const context = useContext(BatchStateContext);
  if (!context) {
    throw new Error("useBatchState must be used within BatchWizardProvider");
  }
  return context;
}

/**
 * Batch 검증 Context Hook
 */
export function useBatchValidation(): BatchValidationContextValue {
  const context = useContext(BatchValidationContext);
  if (!context) {
    throw new Error(
      "useBatchValidation must be used within BatchWizardProvider"
    );
  }
  return context;
}

/**
 * Batch Dispatch Hook (고급 사용)
 */
export function useBatchDispatch(): React.Dispatch<BatchWizardAction> {
  const context = useContext(BatchDispatchContext);
  if (!context) {
    throw new Error("useBatchDispatch must be used within BatchWizardProvider");
  }
  return context;
}

/**
 * 모든 Batch Context 통합 Hook
 */
export function useBatchWizard() {
  return {
    data: useBatchData(),
    step: useBatchStep(),
    state: useBatchState(),
    validation: useBatchValidation(),
    dispatch: useBatchDispatch(),
  };
}
