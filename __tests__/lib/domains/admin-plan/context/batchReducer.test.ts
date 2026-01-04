/**
 * Batch Wizard Reducer Tests
 * Phase 6: BatchAIPlanModal 4-Layer Context 연동
 *
 * Reducer 로직 단위 테스트 (React 의존성 없음)
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================
// 테스트용 타입 정의 (실제 타입을 import하면 React 의존성 발생)
// ============================================

type BatchModalStep = "settings" | "preview" | "progress" | "results";

interface CostEstimate {
  estimatedCostPerStudent: number;
  estimatedTotalCost: number;
  modelTier: string;
}

interface StudentContentInfo {
  studentId: string;
  contentIds: string[];
}

interface BatchPlanSettings {
  startDate: string;
  endDate: string;
  dailyStudyMinutes: number;
  prioritizeWeakSubjects: boolean;
  balanceSubjects: boolean;
  includeReview: boolean;
  modelTier: "fast" | "standard" | "quality";
}

interface StudentPlanResult {
  studentId: string;
  studentName: string;
  status: "success" | "error" | "skipped";
  planCount?: number;
  error?: string;
}

interface BatchWizardData {
  settings: BatchPlanSettings;
  estimatedCost: CostEstimate | null;
  progress: number;
  currentStudent: string;
  results: StudentPlanResult[];
  finalResult: unknown | null;
  previewResult: unknown | null;
  selectedStudentIds: string[];
  previewStudents: StudentContentInfo[];
  retryMode: boolean;
  selectedRetryIds: string[];
  originalContentsMap: Map<string, string[]>;
}

interface BatchWizardState {
  data: BatchWizardData;
  currentStep: BatchModalStep;
  isLoading: boolean;
  error: string | null;
  validationErrors: string[];
}

type BatchDataAction =
  | { type: "UPDATE_SETTINGS"; payload: Partial<BatchPlanSettings> }
  | { type: "SET_ESTIMATED_COST"; payload: CostEstimate | null }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "SET_CURRENT_STUDENT"; payload: string }
  | { type: "ADD_RESULT"; payload: StudentPlanResult }
  | { type: "SET_RESULTS"; payload: StudentPlanResult[] }
  | { type: "SET_FINAL_RESULT"; payload: unknown | null }
  | { type: "SET_PREVIEW_RESULT"; payload: unknown | null }
  | { type: "SET_SELECTED_STUDENT_IDS"; payload: string[] }
  | { type: "SET_PREVIEW_STUDENTS"; payload: StudentContentInfo[] }
  | { type: "SET_RETRY_MODE"; payload: boolean }
  | { type: "SET_SELECTED_RETRY_IDS"; payload: string[] }
  | { type: "SET_ORIGINAL_CONTENTS_MAP"; payload: Map<string, string[]> };

type BatchStepAction =
  | { type: "SET_STEP"; payload: BatchModalStep }
  | { type: "GO_TO_SETTINGS" }
  | { type: "GO_TO_PREVIEW" }
  | { type: "GO_TO_PROGRESS" }
  | { type: "GO_TO_RESULTS" };

type BatchStateAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

type BatchValidationAction =
  | { type: "SET_VALIDATION_ERRORS"; payload: string[] }
  | { type: "CLEAR_VALIDATION" };

type BatchWizardAction =
  | BatchDataAction
  | BatchStepAction
  | BatchStateAction
  | BatchValidationAction;

// ============================================
// 순수 함수들 (batchTypes.ts에서 추출)
// ============================================

function createDefaultSettings(): BatchPlanSettings {
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

function createDefaultBatchData(): BatchWizardData {
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

function createInitialBatchState(): BatchWizardState {
  return {
    data: createDefaultBatchData(),
    currentStep: "settings",
    isLoading: false,
    error: null,
    validationErrors: [],
  };
}

// ============================================
// Reducer 함수 (batchReducer.ts에서 추출)
// ============================================

function batchReducer(
  state: BatchWizardState,
  action: BatchWizardAction
): BatchWizardState {
  switch (action.type) {
    // Data Actions
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

    // Step Actions
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

    // State Actions
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

    // Validation Actions
    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.payload };

    case "CLEAR_VALIDATION":
      return { ...state, validationErrors: [] };

    default:
      return state;
  }
}

// ============================================
// 헬퍼 함수들 (batchReducer.ts에서 추출)
// ============================================

function hasDataChanged(
  current: BatchWizardData,
  initial: BatchWizardData
): boolean {
  const settingsChanged =
    JSON.stringify(current.settings) !== JSON.stringify(initial.settings);
  const resultsChanged = current.results.length !== initial.results.length;
  return settingsChanged || resultsChanged;
}

function hasRetryableStudents(results: StudentPlanResult[]): boolean {
  return results.some((r) => r.status === "error" || r.status === "skipped");
}

function getSuccessCount(results: StudentPlanResult[]): number {
  return results.filter((r) => r.status === "success").length;
}

function getFailureCount(results: StudentPlanResult[]): number {
  return results.filter(
    (r) => r.status === "error" || r.status === "skipped"
  ).length;
}

// ============================================
// 테스트
// ============================================

describe("batchReducer", () => {
  let initialState: BatchWizardState;

  beforeEach(() => {
    initialState = createInitialBatchState();
  });

  // ============================================
  // Data Actions
  // ============================================

  describe("Data Actions", () => {
    it("UPDATE_SETTINGS should update settings partially", () => {
      const newState = batchReducer(initialState, {
        type: "UPDATE_SETTINGS",
        payload: { dailyStudyMinutes: 240 },
      });

      expect(newState.data.settings.dailyStudyMinutes).toBe(240);
      // 다른 설정은 유지
      expect(newState.data.settings.prioritizeWeakSubjects).toBe(true);
      expect(newState.data.settings.modelTier).toBe("fast");
    });

    it("UPDATE_SETTINGS should update multiple fields", () => {
      const newState = batchReducer(initialState, {
        type: "UPDATE_SETTINGS",
        payload: {
          dailyStudyMinutes: 120,
          modelTier: "quality",
          includeReview: true,
        },
      });

      expect(newState.data.settings.dailyStudyMinutes).toBe(120);
      expect(newState.data.settings.modelTier).toBe("quality");
      expect(newState.data.settings.includeReview).toBe(true);
    });

    it("SET_ESTIMATED_COST should set cost estimate", () => {
      const cost: CostEstimate = {
        estimatedCostPerStudent: 0.05,
        estimatedTotalCost: 2.5,
        modelTier: "fast",
      };

      const newState = batchReducer(initialState, {
        type: "SET_ESTIMATED_COST",
        payload: cost,
      });

      expect(newState.data.estimatedCost).toEqual(cost);
    });

    it("SET_ESTIMATED_COST should allow null", () => {
      // 먼저 값 설정
      const stateWithCost = batchReducer(initialState, {
        type: "SET_ESTIMATED_COST",
        payload: { estimatedCostPerStudent: 0.05, estimatedTotalCost: 2.5, modelTier: "fast" },
      });

      // null로 리셋
      const newState = batchReducer(stateWithCost, {
        type: "SET_ESTIMATED_COST",
        payload: null,
      });

      expect(newState.data.estimatedCost).toBeNull();
    });

    it("SET_PROGRESS should update progress", () => {
      const newState = batchReducer(initialState, {
        type: "SET_PROGRESS",
        payload: 75,
      });

      expect(newState.data.progress).toBe(75);
    });

    it("SET_CURRENT_STUDENT should update current student", () => {
      const newState = batchReducer(initialState, {
        type: "SET_CURRENT_STUDENT",
        payload: "홍길동",
      });

      expect(newState.data.currentStudent).toBe("홍길동");
    });

    it("ADD_RESULT should append result to array", () => {
      const result1: StudentPlanResult = {
        studentId: "s1",
        studentName: "학생1",
        status: "success",
        planCount: 10,
      };

      const state1 = batchReducer(initialState, {
        type: "ADD_RESULT",
        payload: result1,
      });

      expect(state1.data.results).toHaveLength(1);
      expect(state1.data.results[0]).toEqual(result1);

      const result2: StudentPlanResult = {
        studentId: "s2",
        studentName: "학생2",
        status: "error",
        error: "콘텐츠 없음",
      };

      const state2 = batchReducer(state1, {
        type: "ADD_RESULT",
        payload: result2,
      });

      expect(state2.data.results).toHaveLength(2);
      expect(state2.data.results[1]).toEqual(result2);
    });

    it("SET_RESULTS should replace all results", () => {
      // 기존 결과 추가
      let state = batchReducer(initialState, {
        type: "ADD_RESULT",
        payload: { studentId: "old", studentName: "Old", status: "success" },
      });

      const newResults: StudentPlanResult[] = [
        { studentId: "new1", studentName: "New1", status: "success", planCount: 5 },
        { studentId: "new2", studentName: "New2", status: "success", planCount: 8 },
      ];

      state = batchReducer(state, {
        type: "SET_RESULTS",
        payload: newResults,
      });

      expect(state.data.results).toEqual(newResults);
      expect(state.data.results).toHaveLength(2);
    });

    it("SET_SELECTED_STUDENT_IDS should update selected IDs", () => {
      const ids = ["s1", "s2", "s3"];

      const newState = batchReducer(initialState, {
        type: "SET_SELECTED_STUDENT_IDS",
        payload: ids,
      });

      expect(newState.data.selectedStudentIds).toEqual(ids);
    });

    it("SET_PREVIEW_STUDENTS should update preview students", () => {
      const students: StudentContentInfo[] = [
        { studentId: "s1", contentIds: ["c1", "c2"] },
        { studentId: "s2", contentIds: ["c3"] },
      ];

      const newState = batchReducer(initialState, {
        type: "SET_PREVIEW_STUDENTS",
        payload: students,
      });

      expect(newState.data.previewStudents).toEqual(students);
    });

    it("SET_RETRY_MODE should toggle retry mode", () => {
      const state1 = batchReducer(initialState, {
        type: "SET_RETRY_MODE",
        payload: true,
      });
      expect(state1.data.retryMode).toBe(true);

      const state2 = batchReducer(state1, {
        type: "SET_RETRY_MODE",
        payload: false,
      });
      expect(state2.data.retryMode).toBe(false);
    });

    it("SET_SELECTED_RETRY_IDS should update retry IDs", () => {
      const ids = ["s1", "s3"];

      const newState = batchReducer(initialState, {
        type: "SET_SELECTED_RETRY_IDS",
        payload: ids,
      });

      expect(newState.data.selectedRetryIds).toEqual(ids);
    });

    it("SET_ORIGINAL_CONTENTS_MAP should update map", () => {
      const map = new Map<string, string[]>([
        ["s1", ["c1", "c2"]],
        ["s2", ["c3"]],
      ]);

      const newState = batchReducer(initialState, {
        type: "SET_ORIGINAL_CONTENTS_MAP",
        payload: map,
      });

      expect(newState.data.originalContentsMap).toEqual(map);
      expect(newState.data.originalContentsMap.get("s1")).toEqual(["c1", "c2"]);
    });
  });

  // ============================================
  // Step Actions
  // ============================================

  describe("Step Actions", () => {
    it("SET_STEP should change current step", () => {
      const newState = batchReducer(initialState, {
        type: "SET_STEP",
        payload: "progress",
      });

      expect(newState.currentStep).toBe("progress");
    });

    it("GO_TO_SETTINGS should set step to settings", () => {
      const stateAtProgress = { ...initialState, currentStep: "progress" as BatchModalStep };

      const newState = batchReducer(stateAtProgress, {
        type: "GO_TO_SETTINGS",
      });

      expect(newState.currentStep).toBe("settings");
    });

    it("GO_TO_PREVIEW should set step to preview", () => {
      const newState = batchReducer(initialState, {
        type: "GO_TO_PREVIEW",
      });

      expect(newState.currentStep).toBe("preview");
    });

    it("GO_TO_PROGRESS should set step to progress", () => {
      const newState = batchReducer(initialState, {
        type: "GO_TO_PROGRESS",
      });

      expect(newState.currentStep).toBe("progress");
    });

    it("GO_TO_RESULTS should set step to results", () => {
      const newState = batchReducer(initialState, {
        type: "GO_TO_RESULTS",
      });

      expect(newState.currentStep).toBe("results");
    });

    it("step navigation should be independent of other state", () => {
      // 상태 변경
      let state = batchReducer(initialState, {
        type: "SET_PROGRESS",
        payload: 50,
      });
      state = batchReducer(state, {
        type: "SET_CURRENT_STUDENT",
        payload: "학생1",
      });

      // 스텝 변경
      state = batchReducer(state, { type: "GO_TO_PROGRESS" });

      // 스텝만 변경되고 데이터는 유지
      expect(state.currentStep).toBe("progress");
      expect(state.data.progress).toBe(50);
      expect(state.data.currentStudent).toBe("학생1");
    });
  });

  // ============================================
  // State Actions
  // ============================================

  describe("State Actions", () => {
    it("SET_LOADING should toggle loading state", () => {
      const state1 = batchReducer(initialState, {
        type: "SET_LOADING",
        payload: true,
      });
      expect(state1.isLoading).toBe(true);

      const state2 = batchReducer(state1, {
        type: "SET_LOADING",
        payload: false,
      });
      expect(state2.isLoading).toBe(false);
    });

    it("SET_ERROR should set error message", () => {
      const newState = batchReducer(initialState, {
        type: "SET_ERROR",
        payload: "네트워크 오류가 발생했습니다",
      });

      expect(newState.error).toBe("네트워크 오류가 발생했습니다");
    });

    it("SET_ERROR should allow clearing error with null", () => {
      const stateWithError = batchReducer(initialState, {
        type: "SET_ERROR",
        payload: "오류",
      });

      const newState = batchReducer(stateWithError, {
        type: "SET_ERROR",
        payload: null,
      });

      expect(newState.error).toBeNull();
    });

    it("RESET should restore initial state", () => {
      // 상태 변경
      let state = batchReducer(initialState, {
        type: "UPDATE_SETTINGS",
        payload: { dailyStudyMinutes: 300 },
      });
      state = batchReducer(state, {
        type: "SET_STEP",
        payload: "results",
      });
      state = batchReducer(state, {
        type: "SET_LOADING",
        payload: true,
      });
      state = batchReducer(state, {
        type: "SET_ERROR",
        payload: "에러",
      });
      state = batchReducer(state, {
        type: "ADD_RESULT",
        payload: { studentId: "s1", studentName: "학생1", status: "success" },
      });

      // 리셋
      const resetState = batchReducer(state, { type: "RESET" });

      expect(resetState.currentStep).toBe("settings");
      expect(resetState.isLoading).toBe(false);
      expect(resetState.error).toBeNull();
      expect(resetState.validationErrors).toEqual([]);
      expect(resetState.data.results).toEqual([]);
      expect(resetState.data.progress).toBe(0);
      expect(resetState.data.settings.dailyStudyMinutes).toBe(180);
    });
  });

  // ============================================
  // Validation Actions
  // ============================================

  describe("Validation Actions", () => {
    it("SET_VALIDATION_ERRORS should set errors", () => {
      const errors = ["기간을 선택하세요", "학생을 선택하세요"];

      const newState = batchReducer(initialState, {
        type: "SET_VALIDATION_ERRORS",
        payload: errors,
      });

      expect(newState.validationErrors).toEqual(errors);
    });

    it("SET_VALIDATION_ERRORS should replace existing errors", () => {
      let state = batchReducer(initialState, {
        type: "SET_VALIDATION_ERRORS",
        payload: ["기존 에러"],
      });

      state = batchReducer(state, {
        type: "SET_VALIDATION_ERRORS",
        payload: ["새 에러1", "새 에러2"],
      });

      expect(state.validationErrors).toEqual(["새 에러1", "새 에러2"]);
    });

    it("CLEAR_VALIDATION should clear all errors", () => {
      const stateWithErrors = batchReducer(initialState, {
        type: "SET_VALIDATION_ERRORS",
        payload: ["에러1", "에러2"],
      });

      const newState = batchReducer(stateWithErrors, {
        type: "CLEAR_VALIDATION",
      });

      expect(newState.validationErrors).toEqual([]);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe("Edge Cases", () => {
    it("unknown action should return current state", () => {
      const unknownAction = { type: "UNKNOWN_ACTION" } as unknown as BatchWizardAction;
      const newState = batchReducer(initialState, unknownAction);

      expect(newState).toBe(initialState);
    });

    it("state should be immutable (no mutation)", () => {
      const originalResults = initialState.data.results;

      batchReducer(initialState, {
        type: "ADD_RESULT",
        payload: { studentId: "s1", studentName: "학생1", status: "success" },
      });

      expect(initialState.data.results).toBe(originalResults);
      expect(initialState.data.results).toHaveLength(0);
    });

    it("nested settings should be immutably updated", () => {
      const originalSettings = initialState.data.settings;

      batchReducer(initialState, {
        type: "UPDATE_SETTINGS",
        payload: { dailyStudyMinutes: 999 },
      });

      expect(initialState.data.settings).toBe(originalSettings);
      expect(initialState.data.settings.dailyStudyMinutes).toBe(180);
    });
  });
});

// ============================================
// Helper Functions Tests
// ============================================

describe("batchReducer helpers", () => {
  describe("hasDataChanged", () => {
    it("should return false for identical data", () => {
      const data1 = createDefaultBatchData();
      const data2 = createDefaultBatchData();

      expect(hasDataChanged(data1, data2)).toBe(false);
    });

    it("should return true when settings change", () => {
      const data1 = createDefaultBatchData();
      const data2 = createDefaultBatchData();
      data2.settings.dailyStudyMinutes = 240;

      expect(hasDataChanged(data1, data2)).toBe(true);
    });

    it("should return true when results count changes", () => {
      const data1 = createDefaultBatchData();
      const data2 = createDefaultBatchData();
      data2.results = [{ studentId: "s1", studentName: "학생1", status: "success" }];

      expect(hasDataChanged(data1, data2)).toBe(true);
    });

    it("should detect nested settings changes", () => {
      const data1 = createDefaultBatchData();
      const data2 = createDefaultBatchData();
      data2.settings.modelTier = "quality";

      expect(hasDataChanged(data1, data2)).toBe(true);
    });
  });

  describe("hasRetryableStudents", () => {
    it("should return false for empty results", () => {
      expect(hasRetryableStudents([])).toBe(false);
    });

    it("should return false when all successful", () => {
      const results: StudentPlanResult[] = [
        { studentId: "s1", studentName: "학생1", status: "success" },
        { studentId: "s2", studentName: "학생2", status: "success" },
      ];

      expect(hasRetryableStudents(results)).toBe(false);
    });

    it("should return true when has error", () => {
      const results: StudentPlanResult[] = [
        { studentId: "s1", studentName: "학생1", status: "success" },
        { studentId: "s2", studentName: "학생2", status: "error", error: "실패" },
      ];

      expect(hasRetryableStudents(results)).toBe(true);
    });

    it("should return true when has skipped", () => {
      const results: StudentPlanResult[] = [
        { studentId: "s1", studentName: "학생1", status: "success" },
        { studentId: "s2", studentName: "학생2", status: "skipped" },
      ];

      expect(hasRetryableStudents(results)).toBe(true);
    });
  });

  describe("getSuccessCount", () => {
    it("should return 0 for empty results", () => {
      expect(getSuccessCount([])).toBe(0);
    });

    it("should count successful results", () => {
      const results: StudentPlanResult[] = [
        { studentId: "s1", studentName: "학생1", status: "success" },
        { studentId: "s2", studentName: "학생2", status: "error" },
        { studentId: "s3", studentName: "학생3", status: "success" },
        { studentId: "s4", studentName: "학생4", status: "skipped" },
      ];

      expect(getSuccessCount(results)).toBe(2);
    });
  });

  describe("getFailureCount", () => {
    it("should return 0 for empty results", () => {
      expect(getFailureCount([])).toBe(0);
    });

    it("should count error and skipped results", () => {
      const results: StudentPlanResult[] = [
        { studentId: "s1", studentName: "학생1", status: "success" },
        { studentId: "s2", studentName: "학생2", status: "error" },
        { studentId: "s3", studentName: "학생3", status: "success" },
        { studentId: "s4", studentName: "학생4", status: "skipped" },
      ];

      expect(getFailureCount(results)).toBe(2);
    });
  });
});

// ============================================
// Integration Scenarios
// ============================================

describe("batchReducer integration scenarios", () => {
  it("should handle complete batch generation flow", () => {
    let state = createInitialBatchState();

    // 1. 설정 업데이트
    state = batchReducer(state, {
      type: "UPDATE_SETTINGS",
      payload: { dailyStudyMinutes: 120, modelTier: "standard" },
    });

    // 2. 학생 선택
    state = batchReducer(state, {
      type: "SET_SELECTED_STUDENT_IDS",
      payload: ["s1", "s2", "s3"],
    });

    // 3. 미리보기로 이동
    state = batchReducer(state, { type: "GO_TO_PREVIEW" });
    expect(state.currentStep).toBe("preview");

    // 4. 미리보기 결과 설정
    state = batchReducer(state, {
      type: "SET_PREVIEW_RESULT",
      payload: { students: [], totalPlans: 30 },
    });

    // 5. 생성 시작 (progress로 이동)
    state = batchReducer(state, { type: "GO_TO_PROGRESS" });
    state = batchReducer(state, { type: "SET_LOADING", payload: true });

    // 6. 진행률 업데이트 + 결과 추가 (SSE 이벤트 시뮬레이션)
    state = batchReducer(state, { type: "SET_CURRENT_STUDENT", payload: "학생1" });
    state = batchReducer(state, { type: "SET_PROGRESS", payload: 33 });
    state = batchReducer(state, {
      type: "ADD_RESULT",
      payload: { studentId: "s1", studentName: "학생1", status: "success", planCount: 10 },
    });

    state = batchReducer(state, { type: "SET_CURRENT_STUDENT", payload: "학생2" });
    state = batchReducer(state, { type: "SET_PROGRESS", payload: 66 });
    state = batchReducer(state, {
      type: "ADD_RESULT",
      payload: { studentId: "s2", studentName: "학생2", status: "error", error: "콘텐츠 없음" },
    });

    state = batchReducer(state, { type: "SET_CURRENT_STUDENT", payload: "학생3" });
    state = batchReducer(state, { type: "SET_PROGRESS", payload: 100 });
    state = batchReducer(state, {
      type: "ADD_RESULT",
      payload: { studentId: "s3", studentName: "학생3", status: "success", planCount: 12 },
    });

    // 7. 완료 처리
    state = batchReducer(state, { type: "SET_LOADING", payload: false });
    state = batchReducer(state, { type: "GO_TO_RESULTS" });

    // 검증
    expect(state.currentStep).toBe("results");
    expect(state.isLoading).toBe(false);
    expect(state.data.results).toHaveLength(3);
    expect(getSuccessCount(state.data.results)).toBe(2);
    expect(getFailureCount(state.data.results)).toBe(1);
    expect(hasRetryableStudents(state.data.results)).toBe(true);
  });

  it("should handle retry flow", () => {
    // 1. 초기 실패 결과가 있는 상태
    let state = createInitialBatchState();
    state = batchReducer(state, {
      type: "SET_RESULTS",
      payload: [
        { studentId: "s1", studentName: "학생1", status: "success", planCount: 10 },
        { studentId: "s2", studentName: "학생2", status: "error", error: "실패" },
        { studentId: "s3", studentName: "학생3", status: "skipped" },
      ],
    });
    state = batchReducer(state, { type: "SET_STEP", payload: "results" });

    // 2. 재시도 모드 활성화
    state = batchReducer(state, { type: "SET_RETRY_MODE", payload: true });
    expect(state.data.retryMode).toBe(true);

    // 3. 재시도할 학생 선택
    state = batchReducer(state, {
      type: "SET_SELECTED_RETRY_IDS",
      payload: ["s2", "s3"],
    });

    // 4. 원본 콘텐츠 저장
    const contentsMap = new Map([
      ["s2", ["c1", "c2"]],
      ["s3", ["c3"]],
    ]);
    state = batchReducer(state, {
      type: "SET_ORIGINAL_CONTENTS_MAP",
      payload: contentsMap,
    });

    // 검증
    expect(state.data.retryMode).toBe(true);
    expect(state.data.selectedRetryIds).toEqual(["s2", "s3"]);
    expect(state.data.originalContentsMap.size).toBe(2);
  });

  it("should handle error recovery", () => {
    let state = createInitialBatchState();

    // 진행 중 에러 발생
    state = batchReducer(state, { type: "GO_TO_PROGRESS" });
    state = batchReducer(state, { type: "SET_LOADING", payload: true });
    state = batchReducer(state, { type: "SET_PROGRESS", payload: 50 });
    state = batchReducer(state, {
      type: "SET_ERROR",
      payload: "네트워크 연결이 끊어졌습니다",
    });

    expect(state.error).toBe("네트워크 연결이 끊어졌습니다");

    // 에러 클리어하고 재시도
    state = batchReducer(state, { type: "SET_ERROR", payload: null });
    state = batchReducer(state, { type: "GO_TO_SETTINGS" });

    expect(state.error).toBeNull();
    expect(state.currentStep).toBe("settings");
    expect(state.data.progress).toBe(50); // 진행률은 유지
  });
});
