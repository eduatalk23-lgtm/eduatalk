/**
 * Batch Wizard Reducer
 *
 * BatchAIPlanModal의 상태 관리 리듀서
 * 모든 상태 변경을 중앙에서 처리하여 예측 가능한 상태 흐름 제공
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/batchReducer
 */

import type {
  BatchWizardState,
  BatchWizardAction,
  BatchWizardData,
} from "./batchTypes";
import { createDefaultBatchData } from "./batchTypes";

/**
 * Batch Wizard 리듀서
 *
 * @param state 현재 상태
 * @param action 디스패치된 액션
 * @returns 새로운 상태
 */
export function batchReducer(
  state: BatchWizardState,
  action: BatchWizardAction
): BatchWizardState {
  switch (action.type) {
    // ============================================
    // Data Actions
    // ============================================

    case "UPDATE_SETTINGS":
      return {
        ...state,
        data: {
          ...state.data,
          settings: { ...state.data.settings, ...action.payload },
        },
      };

    case "SET_ESTIMATED_COST":
      return {
        ...state,
        data: { ...state.data, estimatedCost: action.payload },
      };

    case "SET_PROGRESS":
      return {
        ...state,
        data: { ...state.data, progress: action.payload },
      };

    case "SET_CURRENT_STUDENT":
      return {
        ...state,
        data: { ...state.data, currentStudent: action.payload },
      };

    case "ADD_RESULT":
      return {
        ...state,
        data: {
          ...state.data,
          results: [...state.data.results, action.payload],
        },
      };

    case "SET_RESULTS":
      return {
        ...state,
        data: { ...state.data, results: action.payload },
      };

    case "SET_FINAL_RESULT":
      return {
        ...state,
        data: { ...state.data, finalResult: action.payload },
      };

    case "SET_PREVIEW_RESULT":
      return {
        ...state,
        data: { ...state.data, previewResult: action.payload },
      };

    case "SET_SELECTED_STUDENT_IDS":
      return {
        ...state,
        data: { ...state.data, selectedStudentIds: action.payload },
      };

    case "SET_PREVIEW_STUDENTS":
      return {
        ...state,
        data: { ...state.data, previewStudents: action.payload },
      };

    case "SET_RETRY_MODE":
      return {
        ...state,
        data: { ...state.data, retryMode: action.payload },
      };

    case "SET_SELECTED_RETRY_IDS":
      return {
        ...state,
        data: { ...state.data, selectedRetryIds: action.payload },
      };

    case "SET_ORIGINAL_CONTENTS_MAP":
      return {
        ...state,
        data: { ...state.data, originalContentsMap: action.payload },
      };

    // ============================================
    // Step Actions
    // ============================================

    case "SET_STEP":
      return { ...state, currentStep: action.payload };

    case "GO_TO_SETTINGS":
      return { ...state, currentStep: "settings" };

    case "GO_TO_PREVIEW":
      return { ...state, currentStep: "preview" };

    case "GO_TO_PROGRESS":
      return { ...state, currentStep: "progress" };

    case "GO_TO_RESULTS":
      return { ...state, currentStep: "results" };

    // ============================================
    // State Actions
    // ============================================

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "RESET":
      return {
        data: createDefaultBatchData(),
        currentStep: "settings",
        isLoading: false,
        error: null,
        validationErrors: [],
      };

    // ============================================
    // Validation Actions
    // ============================================

    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.payload };

    case "CLEAR_VALIDATION":
      return { ...state, validationErrors: [] };

    default:
      return state;
  }
}

/**
 * 데이터 변경 여부 확인
 *
 * @param current 현재 데이터
 * @param initial 초기 데이터
 * @returns 변경 여부
 */
export function hasDataChanged(
  current: BatchWizardData,
  initial: BatchWizardData
): boolean {
  // 설정 비교
  const settingsChanged =
    JSON.stringify(current.settings) !== JSON.stringify(initial.settings);

  // 결과 비교
  const resultsChanged = current.results.length !== initial.results.length;

  return settingsChanged || resultsChanged;
}

/**
 * 재시도 가능한 학생이 있는지 확인
 */
export function hasRetryableStudents(
  results: BatchWizardData["results"]
): boolean {
  return results.some((r) => r.status === "error" || r.status === "skipped");
}

/**
 * 성공한 학생 수 계산
 */
export function getSuccessCount(results: BatchWizardData["results"]): number {
  return results.filter((r) => r.status === "success").length;
}

/**
 * 실패한 학생 수 계산
 */
export function getFailureCount(results: BatchWizardData["results"]): number {
  return results.filter(
    (r) => r.status === "error" || r.status === "skipped"
  ).length;
}
