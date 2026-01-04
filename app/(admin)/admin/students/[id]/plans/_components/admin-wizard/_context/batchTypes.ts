/**
 * Batch AI Plan Modal Context Types
 *
 * BatchAIPlanModal의 4-Layer Context를 위한 타입 정의
 * AdminWizardContext 패턴을 따르되 배치 생성에 맞게 조정
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/batchTypes
 */

import type {
  BatchPlanSettings,
  StudentPlanResult,
  BatchPlanGenerationResult,
} from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";
import type { BatchPreviewResult } from "@/lib/domains/admin-plan/types/preview";
import type { ModelTier } from "@/lib/domains/plan/llm/types";

// ============================================
// 기본 타입
// ============================================

export type BatchModalStep = "settings" | "preview" | "progress" | "results";

/**
 * 비용 추정 결과
 */
export interface CostEstimate {
  estimatedCostPerStudent: number;
  estimatedTotalCost: number;
  modelTier: ModelTier;
}

/**
 * 학생 콘텐츠 정보
 */
export interface StudentContentInfo {
  studentId: string;
  contentIds: string[];
}

// ============================================
// Batch Wizard Data
// ============================================

/**
 * Batch Wizard 데이터
 */
export interface BatchWizardData {
  // 설정
  settings: BatchPlanSettings;
  estimatedCost: CostEstimate | null;

  // 진행 상태
  progress: number;
  currentStudent: string;
  results: StudentPlanResult[];
  finalResult: BatchPlanGenerationResult | null;

  // 미리보기
  previewResult: BatchPreviewResult | null;
  selectedStudentIds: string[];
  previewStudents: StudentContentInfo[];

  // 재시도
  retryMode: boolean;
  selectedRetryIds: string[];
  originalContentsMap: Map<string, string[]>;
}

// ============================================
// Batch Wizard State
// ============================================

/**
 * Batch Wizard 전체 상태
 */
export interface BatchWizardState {
  // 데이터
  data: BatchWizardData;

  // 네비게이션
  currentStep: BatchModalStep;

  // 상태
  isLoading: boolean;
  error: string | null;

  // 검증
  validationErrors: string[];
}

// ============================================
// Action 타입
// ============================================

/**
 * 데이터 관련 액션
 */
export type BatchDataAction =
  | { type: "UPDATE_SETTINGS"; payload: Partial<BatchPlanSettings> }
  | { type: "SET_ESTIMATED_COST"; payload: CostEstimate | null }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "SET_CURRENT_STUDENT"; payload: string }
  | { type: "ADD_RESULT"; payload: StudentPlanResult }
  | { type: "SET_RESULTS"; payload: StudentPlanResult[] }
  | { type: "SET_FINAL_RESULT"; payload: BatchPlanGenerationResult | null }
  | { type: "SET_PREVIEW_RESULT"; payload: BatchPreviewResult | null }
  | { type: "SET_SELECTED_STUDENT_IDS"; payload: string[] }
  | { type: "SET_PREVIEW_STUDENTS"; payload: StudentContentInfo[] }
  | { type: "SET_RETRY_MODE"; payload: boolean }
  | { type: "SET_SELECTED_RETRY_IDS"; payload: string[] }
  | { type: "SET_ORIGINAL_CONTENTS_MAP"; payload: Map<string, string[]> };

/**
 * 단계 네비게이션 액션
 */
export type BatchStepAction =
  | { type: "SET_STEP"; payload: BatchModalStep }
  | { type: "GO_TO_SETTINGS" }
  | { type: "GO_TO_PREVIEW" }
  | { type: "GO_TO_PROGRESS" }
  | { type: "GO_TO_RESULTS" };

/**
 * 상태 관련 액션
 */
export type BatchStateAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

/**
 * 검증 관련 액션
 */
export type BatchValidationAction =
  | { type: "SET_VALIDATION_ERRORS"; payload: string[] }
  | { type: "CLEAR_VALIDATION" };

/**
 * 전체 액션 타입
 */
export type BatchWizardAction =
  | BatchDataAction
  | BatchStepAction
  | BatchStateAction
  | BatchValidationAction;

// ============================================
// Type Guards
// ============================================

const DATA_ACTION_TYPES = [
  "UPDATE_SETTINGS",
  "SET_ESTIMATED_COST",
  "SET_PROGRESS",
  "SET_CURRENT_STUDENT",
  "ADD_RESULT",
  "SET_RESULTS",
  "SET_FINAL_RESULT",
  "SET_PREVIEW_RESULT",
  "SET_SELECTED_STUDENT_IDS",
  "SET_PREVIEW_STUDENTS",
  "SET_RETRY_MODE",
  "SET_SELECTED_RETRY_IDS",
  "SET_ORIGINAL_CONTENTS_MAP",
] as const;

const STEP_ACTION_TYPES = [
  "SET_STEP",
  "GO_TO_SETTINGS",
  "GO_TO_PREVIEW",
  "GO_TO_PROGRESS",
  "GO_TO_RESULTS",
] as const;

const STATE_ACTION_TYPES = ["SET_LOADING", "SET_ERROR", "RESET"] as const;

const VALIDATION_ACTION_TYPES = [
  "SET_VALIDATION_ERRORS",
  "CLEAR_VALIDATION",
] as const;

export function isDataAction(
  action: BatchWizardAction
): action is BatchDataAction {
  return (DATA_ACTION_TYPES as readonly string[]).includes(action.type);
}

export function isStepAction(
  action: BatchWizardAction
): action is BatchStepAction {
  return (STEP_ACTION_TYPES as readonly string[]).includes(action.type);
}

export function isStateAction(
  action: BatchWizardAction
): action is BatchStateAction {
  return (STATE_ACTION_TYPES as readonly string[]).includes(action.type);
}

export function isValidationAction(
  action: BatchWizardAction
): action is BatchValidationAction {
  return (VALIDATION_ACTION_TYPES as readonly string[]).includes(action.type);
}

// ============================================
// Context Value 타입
// ============================================

/**
 * Batch Data Context 값 타입
 */
export interface BatchDataContextValue {
  // 데이터
  settings: BatchPlanSettings;
  estimatedCost: CostEstimate | null;
  progress: number;
  currentStudent: string;
  results: StudentPlanResult[];
  finalResult: BatchPlanGenerationResult | null;
  previewResult: BatchPreviewResult | null;
  selectedStudentIds: string[];
  previewStudents: StudentContentInfo[];
  retryMode: boolean;
  selectedRetryIds: string[];
  originalContentsMap: Map<string, string[]>;

  // 액션
  updateSettings: (settings: Partial<BatchPlanSettings>) => void;
  setEstimatedCost: (cost: CostEstimate | null) => void;
  setProgress: (progress: number) => void;
  setCurrentStudent: (student: string) => void;
  addResult: (result: StudentPlanResult) => void;
  setResults: (results: StudentPlanResult[]) => void;
  setFinalResult: (result: BatchPlanGenerationResult | null) => void;
  setPreviewResult: (result: BatchPreviewResult | null) => void;
  setSelectedStudentIds: (ids: string[]) => void;
  setPreviewStudents: (students: StudentContentInfo[]) => void;
  setRetryMode: (mode: boolean) => void;
  setSelectedRetryIds: (ids: string[]) => void;
  setOriginalContentsMap: (map: Map<string, string[]>) => void;
}

/**
 * Batch Step Context 값 타입
 */
export interface BatchStepContextValue {
  currentStep: BatchModalStep;
  setStep: (step: BatchModalStep) => void;
  goToSettings: () => void;
  goToPreview: () => void;
  goToProgress: () => void;
  goToResults: () => void;
  isSettingsStep: boolean;
  isPreviewStep: boolean;
  isProgressStep: boolean;
  isResultsStep: boolean;
}

/**
 * Batch State Context 값 타입
 */
export interface BatchStateContextValue {
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Batch Validation Context 값 타입
 */
export interface BatchValidationContextValue {
  validationErrors: string[];
  setValidationErrors: (errors: string[]) => void;
  clearValidation: () => void;
  hasErrors: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 기본 설정 생성
 */
export function createDefaultSettings(): BatchPlanSettings {
  const today = new Date();
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(today.getDate() + 30);

  return {
    startDate: today.toISOString().split("T")[0],
    endDate: thirtyDaysLater.toISOString().split("T")[0],
    dailyStudyMinutes: 180,
    prioritizeWeakSubjects: true,
    balanceSubjects: true,
    includeReview: false,
    modelTier: "fast",
  };
}

/**
 * 기본 데이터 생성
 */
export function createDefaultBatchData(): BatchWizardData {
  return {
    settings: createDefaultSettings(),
    estimatedCost: null,
    progress: 0,
    currentStudent: "",
    results: [],
    finalResult: null,
    previewResult: null,
    selectedStudentIds: [],
    previewStudents: [],
    retryMode: false,
    selectedRetryIds: [],
    originalContentsMap: new Map(),
  };
}

/**
 * 초기 상태 생성
 */
export function createInitialBatchState(): BatchWizardState {
  return {
    data: createDefaultBatchData(),
    currentStep: "settings",
    isLoading: false,
    error: null,
    validationErrors: [],
  };
}
