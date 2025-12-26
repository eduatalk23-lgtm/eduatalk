"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { WizardData, WizardStep } from "../PlanGroupWizard";
import { hasWizardDataChanged } from "../utils/wizardDataComparison";
import {
  scrollToFirstErrorField,
  getHighestPriorityErrorField,
} from "../utils/errorFieldUtils";
import {
  getTodayParts,
  formatDateString,
  addDaysToDate,
} from "@/lib/utils/date";

/**
 * Wizard 상태 타입
 */
export type WizardState = {
  wizardData: WizardData;
  initialWizardData: WizardData; // 초기 데이터 (변경 사항 감지용)
  currentStep: WizardStep;
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;
  draftGroupId: string | null;
  isSubmitting: boolean;
  isDirty: boolean; // 변경 사항이 있는지 여부
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
  | { type: "SET_FIELD_ERRORS"; payload: Map<string, string> }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "CLEAR_VALIDATION" }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "RESET_DIRTY_STATE" };

/**
 * Wizard Reducer
 */
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "UPDATE_DATA": {
      const newWizardData = { ...state.wizardData, ...action.payload };
      const isDirty = hasWizardDataChanged(state.initialWizardData, newWizardData);
      return {
        ...state,
        wizardData: newWizardData,
        isDirty,
        validationErrors: [],
        validationWarnings: [],
      };
    }
    case "UPDATE_DATA_FN": {
      const newWizardData = { ...state.wizardData, ...action.payload(state.wizardData) };
      const isDirty = hasWizardDataChanged(state.initialWizardData, newWizardData);
      return {
        ...state,
        wizardData: newWizardData,
        isDirty,
        validationErrors: [],
        validationWarnings: [],
      };
    }
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
        fieldErrors: new Map(action.payload),
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
 * 초기 상태 생성 함수
 * 
 * PlanGroupWizard의 초기 데이터 구조를 고려하여 WizardData를 생성합니다.
 */
function createInitialState(
  initialData?: Partial<WizardData> & {
    groupId?: string;
    _startStep?: number;
    _validationErrors?: string[];
    contents?: WizardData["student_contents"];
  },
  initialStep?: number,
  initialDraftId?: string | null
): WizardState {
  // plan_purpose 정규화 처리 (기존 로직 유지)
  const denormalizePlanPurpose = (purpose: string | null | undefined): "" | "내신대비" | "모의고사(수능)" => {
    if (!purpose) return "";
    if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
    if (purpose === "내신대비" || purpose === "모의고사(수능)") return purpose as "내신대비" | "모의고사(수능)";
    return "";
  };

  // 초기 콘텐츠 상태 처리
  const initialContentsState = {
    student_contents: initialData?.student_contents || initialData?.contents || [],
    recommended_contents: initialData?.recommended_contents || [],
  };

  // B1 개선: 새 플랜 생성 시 기본값 설정
  // groupId가 없으면 새 플랜 생성으로 판단 (edit 모드가 아님)
  const isNewPlan = !initialData?.groupId && !initialDraftId;

  // 오늘 날짜 기본값 계산
  const getDefaultPeriodStart = (): string => {
    if (initialData?.period_start) return initialData.period_start;
    if (!isNewPlan) return ""; // 기존 플랜은 기본값 없음

    const today = getTodayParts();
    return formatDateString(today.year, today.month, today.day);
  };

  // 시작일 + 30일 기본값 계산
  const getDefaultPeriodEnd = (periodStart: string): string => {
    if (initialData?.period_end) return initialData.period_end;
    if (!isNewPlan || !periodStart) return "";

    return addDaysToDate(periodStart, 30);
  };

  const defaultPeriodStart = getDefaultPeriodStart();
  const defaultPeriodEnd = getDefaultPeriodEnd(defaultPeriodStart);

  const defaultWizardData: WizardData = {
    name: initialData?.name || "",
    plan_purpose: denormalizePlanPurpose(initialData?.plan_purpose),
    scheduler_type: (initialData?.scheduler_type as "1730_timetable" | "") || "1730_timetable",
    period_start: defaultPeriodStart,
    period_end: defaultPeriodEnd,
    target_date: initialData?.target_date || undefined,
    block_set_id: initialData?.block_set_id || "",
    scheduler_options: (() => {
      const schedulerOptions = initialData?.scheduler_options;
      const schedulerOptionsRecord = schedulerOptions && typeof schedulerOptions === "object"
        ? schedulerOptions as Record<string, unknown>
        : {};
      
      return {
        ...schedulerOptionsRecord,
        study_days: (schedulerOptionsRecord.study_days as number | undefined) || initialData?.study_review_cycle?.study_days || 6,
        review_days: (schedulerOptionsRecord.review_days as number | undefined) || initialData?.study_review_cycle?.review_days || 1,
        student_level: initialData?.student_level || (schedulerOptionsRecord.student_level as "high" | "medium" | "low" | undefined),
      };
    })(),
    exclusions: initialData?.exclusions?.map((e: WizardData["exclusions"][number]) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason,
      source: e.source,
      is_locked: e.is_locked,
    })) || [],
    academy_schedules: initialData?.academy_schedules?.map((s: WizardData["academy_schedules"][number]) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name,
      subject: s.subject,
      travel_time: s.travel_time,
      source: s.source,
      is_locked: s.is_locked,
    })) || [],
    time_settings: initialData?.time_settings,
    student_contents: initialContentsState.student_contents,
    recommended_contents: initialContentsState.recommended_contents,
    study_review_cycle: initialData?.study_review_cycle || (() => {
      const schedulerOptions = initialData?.scheduler_options;
      const schedulerOptionsRecord = schedulerOptions && typeof schedulerOptions === "object"
        ? schedulerOptions as Record<string, unknown>
        : {};
      
      return {
        study_days: (schedulerOptionsRecord.study_days as number | undefined) || 6,
        review_days: (schedulerOptionsRecord.review_days as number | undefined) || 1,
      };
    })(),
    student_level: initialData?.student_level || (() => {
      const schedulerOptions = initialData?.scheduler_options;
      const schedulerOptionsRecord = schedulerOptions && typeof schedulerOptions === "object"
        ? schedulerOptions as Record<string, unknown>
        : {};
      return schedulerOptionsRecord.student_level as "high" | "medium" | "low" | undefined;
    })(),
    subject_allocations: initialData?.subject_allocations || (() => {
      const schedulerOptions = initialData?.scheduler_options;
      const schedulerOptionsRecord = schedulerOptions && typeof schedulerOptions === "object"
        ? schedulerOptions as Record<string, unknown>
        : {};
      return schedulerOptionsRecord.subject_allocations as WizardData["subject_allocations"];
    })(),
    content_allocations: (() => {
      const schedulerOptions = initialData?.scheduler_options;
      const schedulerOptionsRecord = schedulerOptions && typeof schedulerOptions === "object"
        ? schedulerOptions as Record<string, unknown>
        : {};
      return schedulerOptionsRecord.content_allocations as WizardData["content_allocations"];
    })(),
    subject_constraints: initialData?.subject_constraints,
    additional_period_reallocation: initialData?.additional_period_reallocation,
    non_study_time_blocks: initialData?.non_study_time_blocks,
    daily_schedule: initialData?.daily_schedule,
    plan_type: initialData?.plan_type,
    camp_template_id: initialData?.camp_template_id,
    camp_invitation_id: initialData?.camp_invitation_id,
    templateLockedFields: initialData?.templateLockedFields,
    ...initialData,
  };

  return {
    wizardData: defaultWizardData,
    initialWizardData: { ...defaultWizardData }, // 초기 데이터 복사본 저장
    currentStep: (initialStep || initialData?._startStep || 1) as WizardStep,
    validationErrors: initialData?._validationErrors || [],
    validationWarnings: [],
    fieldErrors: new Map(),
    draftGroupId: initialDraftId || initialData?.groupId || null,
    isSubmitting: false,
    isDirty: false, // 초기 상태는 변경 사항 없음
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
  setFieldErrors: (errors: Map<string, string>) => void;
  clearFieldError: (field: string) => void;
  clearValidation: () => void;
  setDraftId: (id: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  // 변경 사항 감지
  isDirty: boolean;
  resetDirtyState: () => void; // 저장 후 dirty 상태 리셋
  // A4: 오토세이브용 초기 데이터
  initialWizardData: WizardData;
  // UX-1: 에러 필드 스크롤
  scrollToFirstError: () => void;
  getFirstErrorField: () => string | null;
};

export const PlanWizardContext = createContext<PlanWizardContextType | null>(null);

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
  const initialState = createInitialState(initialData, initialStep, initialDraftId);

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

  const setFieldErrors = useCallback((errors: Map<string, string>) => {
    dispatch({ type: "SET_FIELD_ERRORS", payload: errors });
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

  // 변경 사항 감지 (메모이제이션)
  const isDirty = useMemo(() => {
    return hasWizardDataChanged(state.initialWizardData, state.wizardData);
  }, [state.initialWizardData, state.wizardData]);

  // 저장 후 dirty 상태 리셋
  const resetDirtyState = useCallback(() => {
    // initialWizardData를 현재 wizardData로 업데이트하여 dirty 상태 리셋
    dispatch({ type: "RESET_DIRTY_STATE" });
  }, []);

  // UX-1: 에러 필드 스크롤 함수
  const scrollToFirstError = useCallback(() => {
    scrollToFirstErrorField(state.fieldErrors);
  }, [state.fieldErrors]);

  // UX-1: 첫 번째 에러 필드 반환
  const getFirstErrorField = useCallback(() => {
    return getHighestPriorityErrorField(state.fieldErrors);
  }, [state.fieldErrors]);

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
    setFieldErrors,
    clearFieldError,
    clearValidation,
    setDraftId,
    setSubmitting,
    isDirty,
    resetDirtyState,
    initialWizardData: state.initialWizardData,
    scrollToFirstError,
    getFirstErrorField,
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

