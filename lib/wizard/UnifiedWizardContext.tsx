"use client";

/**
 * 통합 위저드 Context
 *
 * 모든 위저드 모드(full, quick, content-add)를 지원하는 통합 Context Provider
 *
 * @module lib/wizard/UnifiedWizardContext
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type {
  WizardMode,
  WizardStepDefinition,
  UnifiedWizardData,
  WizardAction,
  WizardContextValue,
  ValidationResult,
  FieldError,
  StepStatus,
} from "./types";
import { getStepsForMode, findStepById, getNextStep, getPrevStep } from "./stepDefinitions";

// ============================================
// 상수
// ============================================

const DIRTY_CHECK_DEBOUNCE_MS = 300;
const MAX_HISTORY_LENGTH = 50; // Undo/Redo 히스토리 최대 길이

const EMPTY_VALIDATION: ValidationResult = {
  isValid: true,
  errors: [],
  warnings: [],
};

// ============================================
// 리듀서
// ============================================

interface WizardState<T extends UnifiedWizardData> {
  data: T;
  initialData: T;
  validation: ValidationResult;
  isSubmitting: boolean;
  // Undo/Redo 히스토리
  history: T[];
  historyIndex: number;
}

/**
 * 히스토리에 현재 상태 추가
 */
function pushToHistory<T extends UnifiedWizardData>(
  state: WizardState<T>,
  newData: T
): WizardState<T> {
  // 현재 인덱스 이후의 히스토리 제거 (redo 불가능하게)
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(newData);

  // 최대 길이 초과 시 오래된 항목 제거
  if (newHistory.length > MAX_HISTORY_LENGTH) {
    newHistory.shift();
  }

  return {
    ...state,
    data: newData,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    validation: EMPTY_VALIDATION,
  };
}

function wizardReducer<T extends UnifiedWizardData>(
  state: WizardState<T>,
  action: WizardAction<T>
): WizardState<T> {
  const now = new Date().toISOString();

  switch (action.type) {
    case "INIT":
      return {
        data: action.payload,
        initialData: action.payload,
        validation: EMPTY_VALIDATION,
        isSubmitting: false,
        history: [action.payload],
        historyIndex: 0,
      };

    case "UPDATE_DATA": {
      const newData = {
        ...state.data,
        ...action.payload,
        meta: {
          ...state.data.meta,
          updatedAt: now,
          isDirty: true,
        },
      } as T;
      return pushToHistory(state, newData);
    }

    case "UPDATE_FIELD": {
      const { path, value } = action.payload;
      const newData = updateNestedField(state.data, path, value);
      const updatedData = {
        ...newData,
        meta: {
          ...newData.meta,
          updatedAt: now,
          isDirty: true,
        },
      } as T;
      return pushToHistory(state, updatedData);
    }

    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        data: state.history[newIndex],
        historyIndex: newIndex,
        validation: EMPTY_VALIDATION,
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        data: state.history[newIndex],
        historyIndex: newIndex,
        validation: EMPTY_VALIDATION,
      };
    }

    case "PUSH_HISTORY": {
      // 명시적으로 현재 상태를 히스토리에 추가 (중요한 변경 후)
      return pushToHistory(state, state.data);
    }

    case "NEXT_STEP": {
      const steps = getStepsForMode(state.data.mode);
      const nextStep = getNextStep(steps, state.data.currentStepId);
      if (!nextStep) return state;

      const visitedSteps = state.data.visitedSteps.includes(nextStep.id)
        ? state.data.visitedSteps
        : [...state.data.visitedSteps, nextStep.id];

      return {
        ...state,
        data: {
          ...state.data,
          currentStepId: nextStep.id,
          visitedSteps,
          meta: { ...state.data.meta, updatedAt: now },
        } as T,
      };
    }

    case "PREV_STEP": {
      const steps = getStepsForMode(state.data.mode);
      const prevStep = getPrevStep(steps, state.data.currentStepId);
      if (!prevStep) return state;

      return {
        ...state,
        data: {
          ...state.data,
          currentStepId: prevStep.id,
          meta: { ...state.data.meta, updatedAt: now },
        } as T,
      };
    }

    case "GO_TO_STEP": {
      const steps = getStepsForMode(state.data.mode);
      const targetStep = findStepById(steps, action.payload);
      if (!targetStep) return state;

      const visitedSteps = state.data.visitedSteps.includes(action.payload)
        ? state.data.visitedSteps
        : [...state.data.visitedSteps, action.payload];

      return {
        ...state,
        data: {
          ...state.data,
          currentStepId: action.payload,
          visitedSteps,
          meta: { ...state.data.meta, updatedAt: now },
        } as T,
      };
    }

    case "SET_VALIDATION":
      return { ...state, validation: action.payload };

    case "CLEAR_VALIDATION":
      return { ...state, validation: EMPTY_VALIDATION };

    case "SET_FIELD_ERROR": {
      const existingErrors = state.validation.errors.filter(
        (e) => e.field !== action.payload.field
      );
      return {
        ...state,
        validation: {
          ...state.validation,
          isValid: false,
          errors: [...existingErrors, action.payload],
        },
      };
    }

    case "CLEAR_FIELD_ERROR": {
      const filteredErrors = state.validation.errors.filter(
        (e) => e.field !== action.payload
      );
      return {
        ...state,
        validation: {
          ...state.validation,
          isValid: filteredErrors.length === 0,
          errors: filteredErrors,
        },
      };
    }

    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.payload };

    case "SET_DRAFT_ID":
      return {
        ...state,
        data: {
          ...state.data,
          meta: { ...state.data.meta, draftId: action.payload },
        } as T,
      };

    case "RESET_DIRTY":
      return {
        ...state,
        initialData: { ...state.data },
        data: {
          ...state.data,
          meta: { ...state.data.meta, isDirty: false },
        } as T,
      };

    case "RESET":
      return {
        ...state,
        data: state.initialData,
        validation: EMPTY_VALIDATION,
        isSubmitting: false,
        history: [state.initialData],
        historyIndex: 0,
      };

    default:
      return state;
  }
}

/**
 * 중첩된 필드 업데이트 헬퍼
 */
function updateNestedField<T>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split(".");
  if (keys.length === 1) {
    return { ...obj, [path]: value } as T;
  }

  const [first, ...rest] = keys;
  const nested = (obj as Record<string, unknown>)[first] as Record<string, unknown> | undefined;
  return {
    ...obj,
    [first]: updateNestedField(nested || {}, rest.join("."), value),
  } as T;
}

// ============================================
// Context 생성
// ============================================

const UnifiedWizardContext = createContext<WizardContextValue | null>(null);

// ============================================
// Provider Props
// ============================================

export interface UnifiedWizardProviderProps<T extends UnifiedWizardData> {
  children: ReactNode;
  /** 초기 데이터 */
  initialData: T;
  /** 단계별 검증 함수 */
  validators?: Record<string, (data: T) => ValidationResult>;
  /** 자동 저장 활성화 */
  autoSave?: boolean;
  /** 자동 저장 디바운스 (ms) */
  autoSaveDebounce?: number;
  /** 자동 저장 콜백 */
  onAutoSave?: (data: T) => Promise<void>;
  /** 데이터 변경 콜백 */
  onChange?: (data: T) => void;
}

// ============================================
// Provider 컴포넌트
// ============================================

export function UnifiedWizardProvider<T extends UnifiedWizardData>({
  children,
  initialData,
  validators = {},
  autoSave = false,
  autoSaveDebounce = 2000,
  onAutoSave,
  onChange,
}: UnifiedWizardProviderProps<T>) {
  const [state, dispatch] = useReducer(
    wizardReducer as typeof wizardReducer<T>,
    {
      data: initialData,
      initialData,
      validation: EMPTY_VALIDATION,
      isSubmitting: false,
      history: [initialData],
      historyIndex: 0,
    }
  );

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 단계 정의 (조건부 필터링 적용)
  const allSteps = useMemo(
    () => getStepsForMode(state.data.mode),
    [state.data.mode]
  );

  // 조건부 표시 필터링
  const steps = useMemo(() => {
    return allSteps.filter((step) => {
      // visibleWhen이 없으면 항상 표시
      if (!step.visibleWhen) return true;
      return step.visibleWhen(state.data);
    });
  }, [allSteps, state.data]);

  const currentStep = useMemo(
    () => findStepById(steps, state.data.currentStepId) || steps[0],
    [steps, state.data.currentStepId]
  );

  // 검증 함수
  const validate = useCallback(
    (stepId?: string): ValidationResult => {
      const targetStepId = stepId || state.data.currentStepId;
      const validator = validators[targetStepId];

      if (!validator) {
        return EMPTY_VALIDATION;
      }

      const result = validator(state.data as T);
      dispatch({ type: "SET_VALIDATION", payload: result });
      return result;
    },
    [state.data, validators]
  );

  // 액션 함수들
  const updateData = useCallback((updates: Partial<T>) => {
    dispatch({ type: "UPDATE_DATA", payload: updates });
  }, []);

  const updateField = useCallback((path: string, value: unknown) => {
    dispatch({ type: "UPDATE_FIELD", payload: { path, value } });
  }, []);

  const nextStep = useCallback((): boolean => {
    const validationResult = validate();
    if (!validationResult.isValid) {
      return false;
    }

    const next = getNextStep(steps, state.data.currentStepId);
    if (!next) return false;

    // 진입 가능 여부 확인
    if (next.canEnter && !next.canEnter(state.data)) {
      return false;
    }

    dispatch({ type: "NEXT_STEP" });
    return true;
  }, [steps, state.data, validate]);

  const prevStep = useCallback(() => {
    dispatch({ type: "PREV_STEP" });
  }, []);

  const goToStep = useCallback(
    (stepId: string): boolean => {
      const targetStep = findStepById(steps, stepId);
      if (!targetStep) return false;

      // 진입 가능 여부 확인
      if (targetStep.canEnter && !targetStep.canEnter(state.data)) {
        return false;
      }

      // 이미 방문한 단계이거나 이전 단계로만 이동 가능
      const currentIndex = steps.findIndex((s) => s.id === state.data.currentStepId);
      const targetIndex = steps.findIndex((s) => s.id === stepId);

      if (
        targetIndex > currentIndex &&
        !state.data.visitedSteps.includes(stepId)
      ) {
        // 건너뛰기 불가
        return false;
      }

      dispatch({ type: "GO_TO_STEP", payload: stepId });
      return true;
    },
    [steps, state.data]
  );

  const setSubmitting = useCallback((value: boolean) => {
    dispatch({ type: "SET_SUBMITTING", payload: value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Undo/Redo 함수
  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  // 의존 단계 검증 (cross-step validation)
  const validateDependencies = useCallback(
    (stepId: string): ValidationResult => {
      const step = findStepById(allSteps, stepId);
      if (!step?.dependsOn || step.dependsOn.length === 0) {
        return EMPTY_VALIDATION;
      }

      const allErrors: FieldError[] = [];
      const allWarnings: FieldError[] = [];

      for (const depStepId of step.dependsOn) {
        const validator = validators[depStepId];
        if (validator) {
          const result = validator(state.data as T);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
        }
      }

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
      };
    },
    [allSteps, state.data, validators]
  );

  // 필드 가시성 확인
  const isFieldVisible = useCallback(
    (stepId: string, fieldId: string): boolean => {
      const step = findStepById(allSteps, stepId);
      if (!step?.fieldVisibility?.[fieldId]) return true;
      return step.fieldVisibility[fieldId](state.data);
    },
    [allSteps, state.data]
  );

  // 유틸리티 계산
  const canGoNext = useMemo(() => {
    const next = getNextStep(steps, state.data.currentStepId);
    return next !== null;
  }, [steps, state.data.currentStepId]);

  const canGoPrev = useMemo(() => {
    const prev = getPrevStep(steps, state.data.currentStepId);
    return prev !== null;
  }, [steps, state.data.currentStepId]);

  const progress = useMemo(() => {
    const currentIndex = steps.findIndex((s) => s.id === state.data.currentStepId);
    return Math.round(((currentIndex + 1) / steps.length) * 100);
  }, [steps, state.data.currentStepId]);

  const canUndo = useMemo(() => state.historyIndex > 0, [state.historyIndex]);

  const canRedo = useMemo(
    () => state.historyIndex < state.history.length - 1,
    [state.historyIndex, state.history.length]
  );

  const stepStatus = useCallback(
    (stepId: string): StepStatus => {
      if (stepId === state.data.currentStepId) return "current";

      const stepIndex = steps.findIndex((s) => s.id === stepId);
      const currentIndex = steps.findIndex((s) => s.id === state.data.currentStepId);

      if (state.data.visitedSteps.includes(stepId)) {
        // 방문했고 검증 에러가 있는지 확인
        const validator = validators[stepId];
        if (validator) {
          const result = validator(state.data as T);
          if (!result.isValid) return "error";
        }
        return "completed";
      }

      if (stepIndex > currentIndex) return "pending";
      return "pending";
    },
    [steps, state.data, validators]
  );

  // 자동 저장
  useEffect(() => {
    if (!autoSave || !onAutoSave || !state.data.meta.isDirty) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await onAutoSave(state.data as T);
        dispatch({ type: "RESET_DIRTY" });
      } catch (error) {
        console.error("[UnifiedWizard] Auto-save failed:", error);
      }
    }, autoSaveDebounce);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSave, autoSaveDebounce, onAutoSave, state.data]);

  // 데이터 변경 콜백
  useEffect(() => {
    onChange?.(state.data as T);
  }, [state.data, onChange]);

  // Context 값
  const contextValue: WizardContextValue<T> = useMemo(
    () => ({
      data: state.data as T,
      currentStep,
      steps,
      validation: state.validation,
      isSubmitting: state.isSubmitting,
      isDirty: state.data.meta.isDirty,
      updateData,
      updateField,
      nextStep,
      prevStep,
      goToStep,
      validate,
      validateDependencies,
      setSubmitting,
      reset,
      undo,
      redo,
      canUndo,
      canRedo,
      canGoNext,
      canGoPrev,
      progress,
      stepStatus,
      isFieldVisible,
    }),
    [
      state.data,
      state.validation,
      state.isSubmitting,
      currentStep,
      steps,
      updateData,
      updateField,
      nextStep,
      prevStep,
      goToStep,
      validate,
      validateDependencies,
      setSubmitting,
      reset,
      undo,
      redo,
      canUndo,
      canRedo,
      canGoNext,
      canGoPrev,
      progress,
      stepStatus,
      isFieldVisible,
    ]
  );

  return (
    <UnifiedWizardContext.Provider value={contextValue as unknown as WizardContextValue}>
      {children}
    </UnifiedWizardContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

/**
 * 위저드 Context 사용 훅
 */
export function useWizard<T extends UnifiedWizardData = UnifiedWizardData>(): WizardContextValue<T> {
  const context = useContext(UnifiedWizardContext);
  if (!context) {
    throw new Error("useWizard must be used within UnifiedWizardProvider");
  }
  return context as unknown as WizardContextValue<T>;
}

/**
 * 위저드 데이터만 사용하는 훅
 */
export function useWizardData<T extends UnifiedWizardData = UnifiedWizardData>() {
  const { data, updateData, updateField, isDirty } = useWizard<T>();
  return { data, updateData, updateField, isDirty };
}

/**
 * 위저드 네비게이션만 사용하는 훅
 */
export function useWizardNavigation() {
  const { currentStep, steps, nextStep, prevStep, goToStep, canGoNext, canGoPrev, progress } =
    useWizard();
  return { currentStep, steps, nextStep, prevStep, goToStep, canGoNext, canGoPrev, progress };
}

/**
 * 위저드 검증만 사용하는 훅
 */
export function useWizardValidation() {
  const { validation, validate, stepStatus } = useWizard();
  return { validation, validate, stepStatus };
}
