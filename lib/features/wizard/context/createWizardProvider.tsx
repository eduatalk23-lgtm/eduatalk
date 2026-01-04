"use client";

/**
 * Wizard Provider Factory
 *
 * 4-Layer Context 패턴 기반 제네릭 위자드 프로바이더 생성
 * - Data Context: 위자드 데이터 상태 및 업데이트
 * - Step Context: 단계 네비게이션
 * - Validation Context: 검증 상태 관리
 *
 * @example
 * ```typescript
 * const { WizardProvider, useWizardData, useWizardStep, useWizardValidation } =
 *   createWizardProvider(STUDENT_WIZARD_CONFIG, createDefaultStudentWizardData);
 *
 * // 컴포넌트에서 사용
 * function MyStep() {
 *   const { wizardData, updateData } = useWizardData();
 *   const { currentStep, nextStep } = useWizardStep();
 *   const { validationErrors } = useWizardValidation();
 *   // ...
 * }
 * ```
 *
 * @module lib/features/wizard/context/createWizardProvider
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";

import type {
  BaseWizardData,
  WizardAction,
  WizardConfig,
  WizardContextValue,
  WizardDataContextValue,
  WizardProviderFactory,
  WizardProviderProps,
  WizardState,
  WizardStep,
  WizardStepContextValue,
  WizardValidationContextValue,
} from "../types";
import { createWizardReducer } from "./createWizardReducer";

// ============================================
// Factory Function
// ============================================

/**
 * 위자드 프로바이더 팩토리
 *
 * 역할별 위자드 설정에 따른 프로바이더와 훅을 생성합니다.
 *
 * @param config 위자드 설정 (역할, 모드, 기능 플래그 등)
 * @param createDefaultData 기본 데이터 생성 함수
 * @param hasDataChanged 데이터 변경 감지 함수 (선택적)
 * @returns 프로바이더 컴포넌트와 훅
 */
export function createWizardProvider<TData extends BaseWizardData>(
  config: WizardConfig,
  createDefaultData: () => TData,
  hasDataChanged?: (initial: TData, current: TData) => boolean
): WizardProviderFactory<TData> {
  // ============================================
  // Contexts 생성
  // ============================================

  const WizardDataContext = createContext<WizardDataContextValue<TData> | null>(null);
  const WizardStepContext = createContext<WizardStepContextValue | null>(null);
  const WizardValidationContext = createContext<WizardValidationContextValue | null>(null);
  const WizardStateContext = createContext<{
    state: WizardState<TData>;
    dispatch: React.Dispatch<WizardAction<TData>>;
  } | null>(null);

  WizardDataContext.displayName = `${config.role}WizardDataContext`;
  WizardStepContext.displayName = `${config.role}WizardStepContext`;
  WizardValidationContext.displayName = `${config.role}WizardValidationContext`;
  WizardStateContext.displayName = `${config.role}WizardStateContext`;

  // ============================================
  // Reducer 생성
  // ============================================

  const { reducer, createInitialState } = createWizardReducer(config, createDefaultData);

  // ============================================
  // Provider Component
  // ============================================

  function WizardProvider({
    children,
    initialData,
    initialStep,
    initialDraftId,
  }: Omit<WizardProviderProps<TData>, "config">) {
    const [state, dispatch] = useReducer(
      reducer,
      createInitialState(initialData, initialStep, initialDraftId)
    );

    // ============================================
    // Data Context Value
    // ============================================

    const updateData = useCallback((updates: Partial<TData>) => {
      dispatch({ type: "UPDATE_DATA", payload: updates });
    }, []);

    const updateDataFn = useCallback(
      (fn: (prev: TData) => Partial<TData>) => {
        dispatch({ type: "UPDATE_DATA_FN", payload: fn });
      },
      []
    );

    const setDraftId = useCallback((id: string | null) => {
      dispatch({ type: "SET_DRAFT_ID", payload: id });
    }, []);

    const setCreatedGroupId = useCallback((id: string | null) => {
      dispatch({ type: "SET_CREATED_GROUP_ID", payload: id });
    }, []);

    const setSubmitting = useCallback((isSubmitting: boolean) => {
      dispatch({ type: "SET_SUBMITTING", payload: isSubmitting });
    }, []);

    const setError = useCallback((error: string | null) => {
      dispatch({ type: "SET_ERROR", payload: error });
    }, []);

    const resetDirtyState = useCallback(() => {
      dispatch({ type: "RESET_DIRTY_STATE" });
    }, []);

    const reset = useCallback(() => {
      dispatch({ type: "RESET" });
    }, []);

    const dataValue = useMemo<WizardDataContextValue<TData>>(
      () => ({
        wizardData: state.wizardData,
        initialWizardData: state.initialWizardData,
        draftGroupId: state.draftGroupId,
        createdGroupId: state.createdGroupId,
        isDirty: state.isDirty,
        isSubmitting: state.isSubmitting,
        error: state.error,
        updateData,
        updateDataFn,
        setDraftId,
        setCreatedGroupId,
        setSubmitting,
        setError,
        resetDirtyState,
        reset,
      }),
      [
        state.wizardData,
        state.initialWizardData,
        state.draftGroupId,
        state.createdGroupId,
        state.isDirty,
        state.isSubmitting,
        state.error,
        updateData,
        updateDataFn,
        setDraftId,
        setCreatedGroupId,
        setSubmitting,
        setError,
        resetDirtyState,
        reset,
      ]
    );

    // ============================================
    // Step Context Value
    // ============================================

    const nextStep = useCallback(() => {
      dispatch({ type: "NEXT_STEP" });
    }, []);

    const prevStep = useCallback(() => {
      dispatch({ type: "PREV_STEP" });
    }, []);

    const setStep = useCallback((step: WizardStep) => {
      dispatch({ type: "SET_STEP", payload: step });
    }, []);

    const stepValue = useMemo<WizardStepContextValue>(
      () => ({
        currentStep: state.currentStep,
        totalSteps: config.totalSteps,
        stepLabels: config.stepLabels,
        canGoNext: state.currentStep < config.totalSteps,
        canGoPrev: state.currentStep > 1,
        nextStep,
        prevStep,
        setStep,
      }),
      [state.currentStep, nextStep, prevStep, setStep]
    );

    // ============================================
    // Validation Context Value
    // ============================================

    const setErrors = useCallback((errors: string[]) => {
      dispatch({ type: "SET_ERRORS", payload: errors });
    }, []);

    const setWarnings = useCallback((warnings: string[]) => {
      dispatch({ type: "SET_WARNINGS", payload: warnings });
    }, []);

    const setFieldError = useCallback((field: string, error: string) => {
      dispatch({ type: "SET_FIELD_ERROR", payload: { field, error } });
    }, []);

    const setFieldErrors = useCallback((errors: Map<string, string>) => {
      dispatch({ type: "SET_FIELD_ERRORS", payload: errors });
    }, []);

    const clearFieldError = useCallback((field: string) => {
      dispatch({ type: "CLEAR_FIELD_ERROR", payload: field });
    }, []);

    const clearValidation = useCallback(() => {
      dispatch({ type: "CLEAR_VALIDATION" });
    }, []);

    const validationValue = useMemo<WizardValidationContextValue>(
      () => ({
        validationErrors: state.validationErrors,
        validationWarnings: state.validationWarnings,
        fieldErrors: state.fieldErrors,
        hasErrors: state.validationErrors.length > 0 || state.fieldErrors.size > 0,
        hasWarnings: state.validationWarnings.length > 0,
        setErrors,
        setWarnings,
        setFieldError,
        setFieldErrors,
        clearFieldError,
        clearValidation,
      }),
      [
        state.validationErrors,
        state.validationWarnings,
        state.fieldErrors,
        setErrors,
        setWarnings,
        setFieldError,
        setFieldErrors,
        clearFieldError,
        clearValidation,
      ]
    );

    // ============================================
    // State Context Value (for legacy hook)
    // ============================================

    const stateValue = useMemo(
      () => ({ state, dispatch }),
      [state]
    );

    // ============================================
    // Render
    // ============================================

    return (
      <WizardStateContext.Provider value={stateValue}>
        <WizardDataContext.Provider value={dataValue}>
          <WizardStepContext.Provider value={stepValue}>
            <WizardValidationContext.Provider value={validationValue}>
              {children}
            </WizardValidationContext.Provider>
          </WizardStepContext.Provider>
        </WizardDataContext.Provider>
      </WizardStateContext.Provider>
    );
  }

  WizardProvider.displayName = `${config.role}WizardProvider`;

  // ============================================
  // Hooks
  // ============================================

  /**
   * Data Context 훅
   *
   * 위자드 데이터 상태 및 업데이트 메서드에 접근합니다.
   * 데이터 변경만 구독하므로 Step/Validation 변경에 리렌더링되지 않습니다.
   */
  function useWizardData(): WizardDataContextValue<TData> {
    const context = useContext(WizardDataContext);
    if (!context) {
      throw new Error(
        `useWizardData must be used within ${config.role}WizardProvider`
      );
    }
    return context;
  }

  /**
   * Step Context 훅
   *
   * 단계 네비게이션 상태 및 메서드에 접근합니다.
   * 네비게이션만 구독하므로 Data/Validation 변경에 리렌더링되지 않습니다.
   */
  function useWizardStep(): WizardStepContextValue {
    const context = useContext(WizardStepContext);
    if (!context) {
      throw new Error(
        `useWizardStep must be used within ${config.role}WizardProvider`
      );
    }
    return context;
  }

  /**
   * Validation Context 훅
   *
   * 검증 상태 및 에러 관리 메서드에 접근합니다.
   * 검증만 구독하므로 Data/Step 변경에 리렌더링되지 않습니다.
   */
  function useWizardValidation(): WizardValidationContextValue {
    const context = useContext(WizardValidationContext);
    if (!context) {
      throw new Error(
        `useWizardValidation must be used within ${config.role}WizardProvider`
      );
    }
    return context;
  }

  /**
   * 통합 Context 훅 (Deprecated)
   *
   * 기존 usePlanWizard/useAdminWizard와의 하위 호환성을 위해 유지됩니다.
   * 새로운 코드에서는 개별 훅 사용을 권장합니다.
   *
   * @deprecated 성능 최적화를 위해 개별 Context 훅 사용을 권장합니다.
   */
  function useWizard(): WizardContextValue<TData> {
    const stateContext = useContext(WizardStateContext);
    const dataContext = useContext(WizardDataContext);
    const stepContext = useContext(WizardStepContext);
    const validationContext = useContext(WizardValidationContext);

    if (!stateContext || !dataContext || !stepContext || !validationContext) {
      throw new Error(
        `useWizard must be used within ${config.role}WizardProvider`
      );
    }

    return useMemo<WizardContextValue<TData>>(
      () => ({
        // State access
        state: stateContext.state,
        dispatch: stateContext.dispatch,

        // Data
        wizardData: dataContext.wizardData,
        initialWizardData: dataContext.initialWizardData,
        draftGroupId: dataContext.draftGroupId,
        createdGroupId: dataContext.createdGroupId,
        isDirty: dataContext.isDirty,
        isSubmitting: dataContext.isSubmitting,
        error: dataContext.error,
        updateData: dataContext.updateData,
        updateDataFn: dataContext.updateDataFn,
        setDraftId: dataContext.setDraftId,
        setCreatedGroupId: dataContext.setCreatedGroupId,
        setSubmitting: dataContext.setSubmitting,
        setError: dataContext.setError,
        resetDirtyState: dataContext.resetDirtyState,
        reset: dataContext.reset,

        // Step
        currentStep: stepContext.currentStep,
        nextStep: stepContext.nextStep,
        prevStep: stepContext.prevStep,
        setStep: stepContext.setStep,

        // Validation
        validationErrors: validationContext.validationErrors,
        validationWarnings: validationContext.validationWarnings,
        fieldErrors: validationContext.fieldErrors,
        setErrors: validationContext.setErrors,
        setWarnings: validationContext.setWarnings,
        setFieldError: validationContext.setFieldError,
        setFieldErrors: validationContext.setFieldErrors,
        clearFieldError: validationContext.clearFieldError,
        clearValidation: validationContext.clearValidation,
      }),
      [stateContext, dataContext, stepContext, validationContext]
    );
  }

  // ============================================
  // Return Factory Result
  // ============================================

  return {
    WizardProvider,
    useWizardData,
    useWizardStep,
    useWizardValidation,
    useWizard,
    config,
  };
}
