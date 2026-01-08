/**
 * 플랜 생성 통합 섹션 Reducer
 */

import type {
  PlanCreationState,
  PlanCreationStep,
  CreationMethod,
  CreationResult,
} from "./types";

/** Reducer Action 타입 */
export type PlanCreationAction =
  // 학생 선택
  | { type: "TOGGLE_STUDENT"; payload: string }
  | { type: "SELECT_ALL_STUDENTS"; payload: string[] }
  | { type: "CLEAR_SELECTION" }
  // 플래너 선택
  | { type: "SELECT_PLANNER"; payload: string }
  | { type: "CLEAR_PLANNER" }
  // 방법 선택
  | { type: "SELECT_METHOD"; payload: CreationMethod }
  | { type: "CLEAR_METHOD" }
  // 플로우 제어
  | { type: "SET_STEP"; payload: PlanCreationStep }
  | { type: "START_CREATION" }
  | { type: "FINISH_CREATION"; payload: CreationResult[] }
  | { type: "UPDATE_RESULTS"; payload: CreationResult[] }
  // 재시도
  | { type: "START_RETRY"; payload: string[] }
  // 에러
  | { type: "SET_ERROR"; payload: string | null }
  // 리셋
  | { type: "RESET" }
  | { type: "RESET_RESULTS_ONLY" };

/** 초기 상태 생성 */
export function createInitialState(initialSelectedIds?: string[]): PlanCreationState {
  return {
    selectedStudentIds: new Set(initialSelectedIds ?? []),
    selectedPlannerId: null,
    selectedMethod: null,
    currentStep: "student-selection",
    isCreating: false,
    creationResults: [],
    retryStudentIds: [],
    error: null,
  };
}

/** Reducer 함수 */
export function planCreationReducer(
  state: PlanCreationState,
  action: PlanCreationAction
): PlanCreationState {
  switch (action.type) {
    // 학생 선택
    case "TOGGLE_STUDENT": {
      const newSelectedIds = new Set(state.selectedStudentIds);
      if (newSelectedIds.has(action.payload)) {
        newSelectedIds.delete(action.payload);
      } else {
        newSelectedIds.add(action.payload);
      }
      return {
        ...state,
        selectedStudentIds: newSelectedIds,
        // 학생 선택이 변경되면 방법 선택 초기화
        selectedMethod:
          newSelectedIds.size === 0 ? null : state.selectedMethod,
        currentStep:
          newSelectedIds.size === 0 ? "student-selection" : state.currentStep,
      };
    }

    case "SELECT_ALL_STUDENTS": {
      return {
        ...state,
        selectedStudentIds: new Set(action.payload),
      };
    }

    case "CLEAR_SELECTION": {
      return {
        ...state,
        selectedStudentIds: new Set(),
        selectedPlannerId: null,
        selectedMethod: null,
        currentStep: "student-selection",
      };
    }

    // 플래너 선택
    case "SELECT_PLANNER": {
      return {
        ...state,
        selectedPlannerId: action.payload,
        currentStep: "planner-selection",
      };
    }

    case "CLEAR_PLANNER": {
      return {
        ...state,
        selectedPlannerId: null,
        selectedMethod: null,
        currentStep: "planner-selection",
      };
    }

    // 방법 선택
    case "SELECT_METHOD": {
      return {
        ...state,
        selectedMethod: action.payload,
        currentStep: "method-selection",
      };
    }

    case "CLEAR_METHOD": {
      return {
        ...state,
        selectedMethod: null,
        currentStep: "student-selection",
      };
    }

    // 플로우 제어
    case "SET_STEP": {
      return {
        ...state,
        currentStep: action.payload,
      };
    }

    case "START_CREATION": {
      return {
        ...state,
        isCreating: true,
        currentStep: "creation-process",
        creationResults: [],
        error: null,
      };
    }

    case "FINISH_CREATION": {
      return {
        ...state,
        isCreating: false,
        currentStep: "results",
        creationResults: action.payload,
      };
    }

    case "UPDATE_RESULTS": {
      // 기존 결과 중 재시도된 학생 결과를 새 결과로 교체
      const newResultsMap = new Map(
        action.payload.map((r) => [r.studentId, r])
      );
      const updatedResults = state.creationResults.map((r) =>
        newResultsMap.has(r.studentId) ? newResultsMap.get(r.studentId)! : r
      );
      return {
        ...state,
        creationResults: updatedResults,
        isCreating: false,
      };
    }

    case "START_RETRY": {
      // 재시도할 학생들의 상태를 'pending'으로 변경하고 creation-process로 이동
      const retryIds = new Set(action.payload);
      const updatedResults = state.creationResults.map((r) =>
        retryIds.has(r.studentId)
          ? { ...r, status: "skipped" as const, message: "재시도 대기 중..." }
          : r
      );
      return {
        ...state,
        creationResults: updatedResults,
        retryStudentIds: action.payload,
        isCreating: true,
        currentStep: "creation-process",
      };
    }

    // 에러
    case "SET_ERROR": {
      return {
        ...state,
        error: action.payload,
        isCreating: false,
      };
    }

    // 리셋
    case "RESET": {
      return createInitialState();
    }

    case "RESET_RESULTS_ONLY": {
      return {
        ...state,
        creationResults: [],
        currentStep: "method-selection",
        error: null,
      };
    }

    default:
      return state;
  }
}
