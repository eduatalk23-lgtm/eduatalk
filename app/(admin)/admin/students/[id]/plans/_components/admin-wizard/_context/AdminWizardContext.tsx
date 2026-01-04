"use client";

/**
 * AdminWizardContext - 통합 Context Provider
 *
 * Phase 2 성능 최적화: Context 분리
 * - AdminWizardDataContext: 데이터 상태 전용
 * - AdminWizardStepContext: 네비게이션 상태 전용
 * - AdminWizardValidationContext: 검증 상태 전용
 *
 * 각 Context를 분리하여 불필요한 리렌더를 방지합니다.
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/AdminWizardContext
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AdminWizardState,
  AdminWizardAction,
  AdminWizardData,
  AdminWizardDataContextValue,
  AdminWizardStepContextValue,
  AdminWizardValidationContextValue,
  WizardStep,
} from "./types";
import { isDataAction, isStepAction, isValidationAction } from "./types";
import { AdminWizardDataProvider } from "./AdminWizardDataContext";
import { AdminWizardStepProvider } from "./AdminWizardStepContext";
import { AdminWizardValidationProvider } from "./AdminWizardValidationContext";

// ============================================
// 상수
// ============================================

const TOTAL_STEPS = 7;
const DIRTY_CHECK_DEBOUNCE_MS = 300;

// ============================================
// 초기 데이터 생성
// ============================================

function createDefaultWizardData(): AdminWizardData {
  // 오늘 날짜
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  // 30일 후
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  return {
    name: "",
    planPurpose: "",
    periodStart: formatDate(today),
    periodEnd: formatDate(thirtyDaysLater),
    targetDate: undefined,
    blockSetId: undefined,
    schedulerType: "1730_timetable",
    timeSettings: undefined,
    academySchedules: [],
    exclusions: [],
    selectedContents: [],
    skipContents: false,
    schedulerOptions: {
      study_days: 6,
      review_days: 1,
    },
    subjectAllocations: undefined,
    contentAllocations: undefined,
    generateAIPlan: false,
    aiMode: "hybrid",
  };
}

function createInitialState(
  initialData?: Partial<AdminWizardData>,
  initialStep?: WizardStep,
  initialDraftId?: string | null
): AdminWizardState {
  const defaultData = createDefaultWizardData();
  const wizardData: AdminWizardData = {
    ...defaultData,
    ...initialData,
  };

  return {
    wizardData,
    initialWizardData: { ...wizardData },
    currentStep: initialStep || 1,
    validationErrors: [],
    validationWarnings: [],
    fieldErrors: new Map(),
    draftGroupId: initialDraftId || null,
    createdGroupId: null,
    isSubmitting: false,
    isDirty: false,
    error: null,
  };
}

// ============================================
// 데이터 변경 감지 유틸리티
// ============================================

function hasDataChanged(initial: AdminWizardData, current: AdminWizardData): boolean {
  // 핵심 스칼라 필드 비교
  if (initial.name !== current.name) return true;
  if (initial.planPurpose !== current.planPurpose) return true;
  if (initial.periodStart !== current.periodStart) return true;
  if (initial.periodEnd !== current.periodEnd) return true;
  if (initial.schedulerType !== current.schedulerType) return true;
  if (initial.blockSetId !== current.blockSetId) return true;
  if (initial.generateAIPlan !== current.generateAIPlan) return true;
  if (initial.skipContents !== current.skipContents) return true;

  // 배열 길이 비교
  if (initial.selectedContents.length !== current.selectedContents.length) return true;
  if (initial.academySchedules.length !== current.academySchedules.length) return true;
  if (initial.exclusions.length !== current.exclusions.length) return true;

  // 콘텐츠 ID 비교
  const initialContentIds = initial.selectedContents.map(c => c.contentId).sort().join(",");
  const currentContentIds = current.selectedContents.map(c => c.contentId).sort().join(",");
  if (initialContentIds !== currentContentIds) return true;

  return false;
}

// ============================================
// Reducer
// ============================================

function wizardReducer(state: AdminWizardState, action: AdminWizardAction): AdminWizardState {
  // 데이터 관련 액션
  if (isDataAction(action)) {
    switch (action.type) {
      case "UPDATE_DATA": {
        const newWizardData = { ...state.wizardData, ...action.payload };
        const isDirty = hasDataChanged(state.initialWizardData, newWizardData);
        return {
          ...state,
          wizardData: newWizardData,
          isDirty,
          error: null,
        };
      }
      case "UPDATE_DATA_FN": {
        const newWizardData = { ...state.wizardData, ...action.payload(state.wizardData) };
        const isDirty = hasDataChanged(state.initialWizardData, newWizardData);
        return {
          ...state,
          wizardData: newWizardData,
          isDirty,
          error: null,
        };
      }
      case "SET_DRAFT_ID":
        return { ...state, draftGroupId: action.payload };
      case "SET_CREATED_GROUP_ID":
        return { ...state, createdGroupId: action.payload };
      case "SET_SUBMITTING":
        return { ...state, isSubmitting: action.payload };
      case "SET_ERROR":
        return { ...state, error: action.payload };
      case "RESET_DIRTY_STATE":
        return {
          ...state,
          initialWizardData: { ...state.wizardData },
          isDirty: false,
        };
      case "RESET":
        return createInitialState();
    }
  }

  // 단계 네비게이션 액션
  if (isStepAction(action)) {
    switch (action.type) {
      case "NEXT_STEP":
        return {
          ...state,
          currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS) as WizardStep,
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
    }
  }

  // 검증 관련 액션
  if (isValidationAction(action)) {
    switch (action.type) {
      case "SET_ERRORS":
        return { ...state, validationErrors: action.payload };
      case "SET_WARNINGS":
        return { ...state, validationWarnings: action.payload };
      case "SET_FIELD_ERROR": {
        const newFieldErrors = new Map(state.fieldErrors);
        newFieldErrors.set(action.payload.field, action.payload.error);
        return { ...state, fieldErrors: newFieldErrors };
      }
      case "SET_FIELD_ERRORS":
        return { ...state, fieldErrors: new Map(action.payload) };
      case "CLEAR_FIELD_ERROR": {
        const clearedFieldErrors = new Map(state.fieldErrors);
        clearedFieldErrors.delete(action.payload);
        return { ...state, fieldErrors: clearedFieldErrors };
      }
      case "CLEAR_VALIDATION":
        return {
          ...state,
          validationErrors: [],
          validationWarnings: [],
          fieldErrors: new Map(),
        };
    }
  }

  return state;
}

// ============================================
// 통합 Context 타입 (하위 호환성)
// ============================================

type AdminWizardContextType = {
  state: AdminWizardState;
  dispatch: React.Dispatch<AdminWizardAction>;
  // 유틸리티 함수들
  updateData: (updates: Partial<AdminWizardData>) => void;
  updateDataFn: (fn: (prev: AdminWizardData) => Partial<AdminWizardData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: WizardStep) => void;
  setErrors: (errors: string[]) => void;
  setWarnings: (warnings: string[]) => void;
  setFieldError: (field: string, error: string) => void;
  setFieldErrors: (errors: Map<string, string>) => void;
  clearFieldError: (field: string) => void;
  clearValidation: () => void;
  setDraftId: (id: string | null) => void;
  setCreatedGroupId: (id: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  isDirty: boolean;
  resetDirtyState: () => void;
};

export const AdminWizardContext = createContext<AdminWizardContextType | null>(null);

// ============================================
// Provider Props
// ============================================

type AdminWizardProviderProps = {
  children: ReactNode;
  initialData?: Partial<AdminWizardData>;
  initialStep?: WizardStep;
  initialDraftId?: string | null;
};

// ============================================
// Provider
// ============================================

export function AdminWizardProvider({
  children,
  initialData,
  initialStep = 1,
  initialDraftId = null,
}: AdminWizardProviderProps) {
  const initialState = createInitialState(initialData, initialStep, initialDraftId);
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // 유틸리티 함수들
  const updateData = useCallback((updates: Partial<AdminWizardData>) => {
    dispatch({ type: "UPDATE_DATA", payload: updates });
  }, []);

  const updateDataFn = useCallback((fn: (prev: AdminWizardData) => Partial<AdminWizardData>) => {
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

  const setFieldErrors = useCallback((errors: Map<string, string>) => {
    dispatch({ type: "SET_FIELD_ERRORS", payload: errors });
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

  const setCreatedGroupId = useCallback((id: string | null) => {
    dispatch({ type: "SET_CREATED_GROUP_ID", payload: id });
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    dispatch({ type: "SET_SUBMITTING", payload: isSubmitting });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Dirty 상태 디바운스
  const [debouncedIsDirty, setDebouncedIsDirty] = useState(false);
  const dirtyCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dirtyCheckTimeoutRef.current) {
      clearTimeout(dirtyCheckTimeoutRef.current);
    }

    dirtyCheckTimeoutRef.current = setTimeout(() => {
      const isDirtyNow = hasDataChanged(state.initialWizardData, state.wizardData);
      setDebouncedIsDirty(isDirtyNow);
    }, DIRTY_CHECK_DEBOUNCE_MS);

    return () => {
      if (dirtyCheckTimeoutRef.current) {
        clearTimeout(dirtyCheckTimeoutRef.current);
      }
    };
  }, [state.initialWizardData, state.wizardData]);

  const resetDirtyState = useCallback(() => {
    dispatch({ type: "RESET_DIRTY_STATE" });
    setDebouncedIsDirty(false);
  }, []);

  // 분리된 Context 값들 생성
  const dataContextValue: AdminWizardDataContextValue = useMemo(
    () => ({
      wizardData: state.wizardData,
      initialWizardData: state.initialWizardData,
      draftGroupId: state.draftGroupId,
      createdGroupId: state.createdGroupId,
      isDirty: debouncedIsDirty,
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
      debouncedIsDirty,
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

  const stepContextValue: AdminWizardStepContextValue = useMemo(
    () => ({
      currentStep: state.currentStep,
      totalSteps: TOTAL_STEPS,
      nextStep,
      prevStep,
      setStep,
      canGoNext: state.currentStep < TOTAL_STEPS,
      canGoPrev: state.currentStep > 1,
    }),
    [state.currentStep, nextStep, prevStep, setStep]
  );

  const validationContextValue: AdminWizardValidationContextValue = useMemo(
    () => ({
      validationErrors: state.validationErrors,
      validationWarnings: state.validationWarnings,
      fieldErrors: state.fieldErrors,
      setErrors,
      setWarnings,
      setFieldError,
      setFieldErrors,
      clearFieldError,
      clearValidation,
      hasErrors: state.validationErrors.length > 0 || state.fieldErrors.size > 0,
      hasWarnings: state.validationWarnings.length > 0,
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

  // 기존 통합 Context 값 (하위 호환성 유지)
  const value: AdminWizardContextType = useMemo(
    () => ({
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
      setFieldErrors,
      clearFieldError,
      clearValidation,
      setDraftId,
      setCreatedGroupId,
      setSubmitting,
      setError,
      reset,
      isDirty: debouncedIsDirty,
      resetDirtyState,
    }),
    [
      state,
      updateData,
      updateDataFn,
      nextStep,
      prevStep,
      setStep,
      setErrors,
      setWarnings,
      setFieldError,
      setFieldErrors,
      clearFieldError,
      clearValidation,
      setDraftId,
      setCreatedGroupId,
      setSubmitting,
      setError,
      reset,
      debouncedIsDirty,
      resetDirtyState,
    ]
  );

  // 분리된 Context들을 조합하여 제공
  return (
    <AdminWizardContext.Provider value={value}>
      <AdminWizardDataProvider value={dataContextValue}>
        <AdminWizardStepProvider value={stepContextValue}>
          <AdminWizardValidationProvider value={validationContextValue}>
            {children}
          </AdminWizardValidationProvider>
        </AdminWizardStepProvider>
      </AdminWizardDataProvider>
    </AdminWizardContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

/**
 * useAdminWizard Hook
 *
 * 통합 Context를 사용하기 위한 커스텀 훅입니다.
 * Provider 외부에서 사용하면 에러를 발생시킵니다.
 *
 * @deprecated 성능 최적화를 위해 useAdminWizardData, useAdminWizardStep, useAdminWizardValidation 사용을 권장합니다.
 */
export function useAdminWizard(): AdminWizardContextType {
  const context = useContext(AdminWizardContext);
  if (!context) {
    throw new Error("useAdminWizard must be used within AdminWizardProvider");
  }
  return context;
}

// 분리된 Context hooks re-export
export { useAdminWizardData } from "./AdminWizardDataContext";
export { useAdminWizardStep } from "./AdminWizardStepContext";
export { useAdminWizardValidation } from "./AdminWizardValidationContext";

// Type exports
export type { AdminWizardDataContextValue } from "./types";
export type { AdminWizardStepContextValue } from "./types";
export type { AdminWizardValidationContextValue } from "./types";
