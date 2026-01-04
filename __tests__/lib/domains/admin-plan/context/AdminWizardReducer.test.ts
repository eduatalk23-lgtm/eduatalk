/**
 * Admin Wizard Reducer Tests
 * Phase 5: 테스트 및 안정화
 *
 * Reducer 로직 단위 테스트 (React 의존성 없음)
 */

import { describe, it, expect } from "vitest";

// ============================================
// 테스트용 타입 정의 (실제 타입을 import하면 React 의존성 발생)
// ============================================

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface AdminWizardData {
  name: string;
  planPurpose: string;
  periodStart: string;
  periodEnd: string;
  targetDate?: string;
  blockSetId?: string;
  schedulerType: string;
  academySchedules: unknown[];
  exclusions: unknown[];
  selectedContents: unknown[];
  skipContents: boolean;
  schedulerOptions?: Record<string, unknown>;
  generateAIPlan: boolean;
  aiMode: "hybrid" | "ai-only";
}

interface AdminWizardState {
  wizardData: AdminWizardData;
  initialWizardData: AdminWizardData;
  currentStep: WizardStep;
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;
  draftGroupId: string | null;
  createdGroupId: string | null;
  isSubmitting: boolean;
  isDirty: boolean;
  error: string | null;
}

type DataAction =
  | { type: "UPDATE_DATA"; payload: Partial<AdminWizardData> }
  | { type: "UPDATE_DATA_FN"; payload: (prev: AdminWizardData) => Partial<AdminWizardData> }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "SET_CREATED_GROUP_ID"; payload: string | null }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET_DIRTY_STATE" }
  | { type: "RESET" };

type StepAction =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_STEP"; payload: WizardStep };

type ValidationAction =
  | { type: "SET_ERRORS"; payload: string[] }
  | { type: "SET_WARNINGS"; payload: string[] }
  | { type: "SET_FIELD_ERROR"; payload: { field: string; error: string } }
  | { type: "SET_FIELD_ERRORS"; payload: Map<string, string> }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "CLEAR_VALIDATION" };

type AdminWizardAction = DataAction | StepAction | ValidationAction;

// ============================================
// 순수 함수들 (Context에서 추출)
// ============================================

const TOTAL_STEPS = 7;

function createDefaultWizardData(): AdminWizardData {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];
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
    academySchedules: [],
    exclusions: [],
    selectedContents: [],
    skipContents: false,
    schedulerOptions: {
      study_days: 6,
      review_days: 1,
    },
    generateAIPlan: false,
    aiMode: "hybrid",
  };
}

function createInitialState(
  initialData?: Partial<AdminWizardData>,
  initialStep?: WizardStep
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
    draftGroupId: null,
    createdGroupId: null,
    isSubmitting: false,
    isDirty: false,
    error: null,
  };
}

function hasDataChanged(initial: AdminWizardData, current: AdminWizardData): boolean {
  if (initial.name !== current.name) return true;
  if (initial.planPurpose !== current.planPurpose) return true;
  if (initial.periodStart !== current.periodStart) return true;
  if (initial.periodEnd !== current.periodEnd) return true;
  if (initial.schedulerType !== current.schedulerType) return true;
  if (initial.blockSetId !== current.blockSetId) return true;
  if (initial.generateAIPlan !== current.generateAIPlan) return true;
  if (initial.skipContents !== current.skipContents) return true;
  if (initial.selectedContents.length !== current.selectedContents.length) return true;
  if (initial.academySchedules.length !== current.academySchedules.length) return true;
  if (initial.exclusions.length !== current.exclusions.length) return true;
  return false;
}

function isDataAction(action: AdminWizardAction): action is DataAction {
  return [
    "UPDATE_DATA",
    "UPDATE_DATA_FN",
    "SET_DRAFT_ID",
    "SET_CREATED_GROUP_ID",
    "SET_SUBMITTING",
    "SET_ERROR",
    "RESET_DIRTY_STATE",
    "RESET",
  ].includes(action.type);
}

function isStepAction(action: AdminWizardAction): action is StepAction {
  return ["NEXT_STEP", "PREV_STEP", "SET_STEP"].includes(action.type);
}

function isValidationAction(action: AdminWizardAction): action is ValidationAction {
  return [
    "SET_ERRORS",
    "SET_WARNINGS",
    "SET_FIELD_ERROR",
    "SET_FIELD_ERRORS",
    "CLEAR_FIELD_ERROR",
    "CLEAR_VALIDATION",
  ].includes(action.type);
}

function wizardReducer(state: AdminWizardState, action: AdminWizardAction): AdminWizardState {
  if (isDataAction(action)) {
    switch (action.type) {
      case "UPDATE_DATA": {
        const newWizardData = { ...state.wizardData, ...action.payload };
        const isDirty = hasDataChanged(state.initialWizardData, newWizardData);
        return { ...state, wizardData: newWizardData, isDirty, error: null };
      }
      case "UPDATE_DATA_FN": {
        const newWizardData = { ...state.wizardData, ...action.payload(state.wizardData) };
        const isDirty = hasDataChanged(state.initialWizardData, newWizardData);
        return { ...state, wizardData: newWizardData, isDirty, error: null };
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
        return { ...state, initialWizardData: { ...state.wizardData }, isDirty: false };
      case "RESET":
        return createInitialState();
    }
  }

  if (isStepAction(action)) {
    switch (action.type) {
      case "NEXT_STEP":
        return { ...state, currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS) as WizardStep };
      case "PREV_STEP":
        return { ...state, currentStep: Math.max(state.currentStep - 1, 1) as WizardStep };
      case "SET_STEP":
        return { ...state, currentStep: action.payload };
    }
  }

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
        return { ...state, validationErrors: [], validationWarnings: [], fieldErrors: new Map() };
    }
  }

  return state;
}

// ============================================
// 테스트
// ============================================

describe("createDefaultWizardData", () => {
  it("should create default data with correct structure", () => {
    const data = createDefaultWizardData();

    expect(data.name).toBe("");
    expect(data.planPurpose).toBe("");
    expect(data.schedulerType).toBe("1730_timetable");
    expect(data.selectedContents).toEqual([]);
    expect(data.skipContents).toBe(false);
    expect(data.generateAIPlan).toBe(false);
    expect(data.aiMode).toBe("hybrid");
  });

  it("should set periodStart to today", () => {
    const data = createDefaultWizardData();
    const today = new Date().toISOString().split("T")[0];

    expect(data.periodStart).toBe(today);
  });

  it("should set periodEnd to 30 days from now", () => {
    const data = createDefaultWizardData();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const expected = thirtyDaysLater.toISOString().split("T")[0];

    expect(data.periodEnd).toBe(expected);
  });

  it("should include default scheduler options", () => {
    const data = createDefaultWizardData();

    expect(data.schedulerOptions).toEqual({
      study_days: 6,
      review_days: 1,
    });
  });
});

describe("createInitialState", () => {
  it("should create initial state with default data", () => {
    const state = createInitialState();

    expect(state.currentStep).toBe(1);
    expect(state.validationErrors).toEqual([]);
    expect(state.validationWarnings).toEqual([]);
    expect(state.fieldErrors.size).toBe(0);
    expect(state.draftGroupId).toBeNull();
    expect(state.createdGroupId).toBeNull();
    expect(state.isSubmitting).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should apply initial data overrides", () => {
    const state = createInitialState({
      name: "테스트 플랜",
      planPurpose: "내신대비",
    });

    expect(state.wizardData.name).toBe("테스트 플랜");
    expect(state.wizardData.planPurpose).toBe("내신대비");
  });

  it("should apply initial step", () => {
    const state = createInitialState({}, 4);

    expect(state.currentStep).toBe(4);
  });

  it("should copy wizardData to initialWizardData", () => {
    const state = createInitialState({ name: "테스트" });

    expect(state.wizardData.name).toBe(state.initialWizardData.name);
  });
});

describe("hasDataChanged", () => {
  it("should return false for identical data", () => {
    const data = createDefaultWizardData();
    const copy = { ...data };

    expect(hasDataChanged(data, copy)).toBe(false);
  });

  it("should detect name change", () => {
    const initial = createDefaultWizardData();
    const current = { ...initial, name: "변경됨" };

    expect(hasDataChanged(initial, current)).toBe(true);
  });

  it("should detect planPurpose change", () => {
    const initial = createDefaultWizardData();
    const current = { ...initial, planPurpose: "수능" };

    expect(hasDataChanged(initial, current)).toBe(true);
  });

  it("should detect periodStart change", () => {
    const initial = createDefaultWizardData();
    const current = { ...initial, periodStart: "2026-02-01" };

    expect(hasDataChanged(initial, current)).toBe(true);
  });

  it("should detect selectedContents length change", () => {
    const initial = createDefaultWizardData();
    const current = { ...initial, selectedContents: [{ id: "1" }] };

    expect(hasDataChanged(initial, current)).toBe(true);
  });

  it("should detect skipContents change", () => {
    const initial = createDefaultWizardData();
    const current = { ...initial, skipContents: true };

    expect(hasDataChanged(initial, current)).toBe(true);
  });
});

describe("wizardReducer - Data Actions", () => {
  it("should handle UPDATE_DATA", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "UPDATE_DATA",
      payload: { name: "새 플랜" },
    });

    expect(newState.wizardData.name).toBe("새 플랜");
    expect(newState.error).toBeNull();
  });

  it("should handle UPDATE_DATA_FN", () => {
    const state = createInitialState({ name: "기존" });
    const newState = wizardReducer(state, {
      type: "UPDATE_DATA_FN",
      payload: (prev) => ({ name: prev.name + " 추가" }),
    });

    expect(newState.wizardData.name).toBe("기존 추가");
  });

  it("should update isDirty when data changes", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "UPDATE_DATA",
      payload: { name: "변경됨" },
    });

    expect(newState.isDirty).toBe(true);
  });

  it("should handle SET_DRAFT_ID", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_DRAFT_ID",
      payload: "draft-123",
    });

    expect(newState.draftGroupId).toBe("draft-123");
  });

  it("should handle SET_CREATED_GROUP_ID", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_CREATED_GROUP_ID",
      payload: "group-456",
    });

    expect(newState.createdGroupId).toBe("group-456");
  });

  it("should handle SET_SUBMITTING", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_SUBMITTING",
      payload: true,
    });

    expect(newState.isSubmitting).toBe(true);
  });

  it("should handle SET_ERROR", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_ERROR",
      payload: "에러 메시지",
    });

    expect(newState.error).toBe("에러 메시지");
  });

  it("should handle RESET_DIRTY_STATE", () => {
    let state = createInitialState();
    state = wizardReducer(state, { type: "UPDATE_DATA", payload: { name: "변경" } });

    expect(state.isDirty).toBe(true);

    const newState = wizardReducer(state, { type: "RESET_DIRTY_STATE" });

    expect(newState.isDirty).toBe(false);
    expect(newState.initialWizardData.name).toBe("변경");
  });

  it("should handle RESET", () => {
    let state = createInitialState({ name: "테스트" });
    state = wizardReducer(state, { type: "SET_STEP", payload: 5 });
    state = wizardReducer(state, { type: "SET_ERROR", payload: "에러" });

    const newState = wizardReducer(state, { type: "RESET" });

    expect(newState.wizardData.name).toBe("");
    expect(newState.currentStep).toBe(1);
    expect(newState.error).toBeNull();
  });
});

describe("wizardReducer - Step Actions", () => {
  it("should handle NEXT_STEP", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, { type: "NEXT_STEP" });

    expect(newState.currentStep).toBe(2);
  });

  it("should not exceed total steps on NEXT_STEP", () => {
    const state = createInitialState({}, 7);
    const newState = wizardReducer(state, { type: "NEXT_STEP" });

    expect(newState.currentStep).toBe(7);
  });

  it("should handle PREV_STEP", () => {
    const state = createInitialState({}, 3);
    const newState = wizardReducer(state, { type: "PREV_STEP" });

    expect(newState.currentStep).toBe(2);
  });

  it("should not go below step 1 on PREV_STEP", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, { type: "PREV_STEP" });

    expect(newState.currentStep).toBe(1);
  });

  it("should handle SET_STEP", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, { type: "SET_STEP", payload: 5 });

    expect(newState.currentStep).toBe(5);
  });
});

describe("wizardReducer - Validation Actions", () => {
  it("should handle SET_ERRORS", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_ERRORS",
      payload: ["에러 1", "에러 2"],
    });

    expect(newState.validationErrors).toEqual(["에러 1", "에러 2"]);
  });

  it("should handle SET_WARNINGS", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_WARNINGS",
      payload: ["경고 1"],
    });

    expect(newState.validationWarnings).toEqual(["경고 1"]);
  });

  it("should handle SET_FIELD_ERROR", () => {
    const state = createInitialState();
    const newState = wizardReducer(state, {
      type: "SET_FIELD_ERROR",
      payload: { field: "name", error: "이름 필수" },
    });

    expect(newState.fieldErrors.get("name")).toBe("이름 필수");
  });

  it("should handle SET_FIELD_ERRORS", () => {
    const state = createInitialState();
    const errors = new Map([
      ["name", "이름 필수"],
      ["period", "기간 필수"],
    ]);
    const newState = wizardReducer(state, {
      type: "SET_FIELD_ERRORS",
      payload: errors,
    });

    expect(newState.fieldErrors.size).toBe(2);
    expect(newState.fieldErrors.get("name")).toBe("이름 필수");
  });

  it("should handle CLEAR_FIELD_ERROR", () => {
    let state = createInitialState();
    state = wizardReducer(state, {
      type: "SET_FIELD_ERROR",
      payload: { field: "name", error: "에러" },
    });

    expect(state.fieldErrors.has("name")).toBe(true);

    const newState = wizardReducer(state, {
      type: "CLEAR_FIELD_ERROR",
      payload: "name",
    });

    expect(newState.fieldErrors.has("name")).toBe(false);
  });

  it("should handle CLEAR_VALIDATION", () => {
    let state = createInitialState();
    state = wizardReducer(state, { type: "SET_ERRORS", payload: ["에러"] });
    state = wizardReducer(state, { type: "SET_WARNINGS", payload: ["경고"] });
    state = wizardReducer(state, {
      type: "SET_FIELD_ERROR",
      payload: { field: "test", error: "테스트" },
    });

    expect(state.validationErrors.length).toBe(1);
    expect(state.validationWarnings.length).toBe(1);
    expect(state.fieldErrors.size).toBe(1);

    const newState = wizardReducer(state, { type: "CLEAR_VALIDATION" });

    expect(newState.validationErrors).toEqual([]);
    expect(newState.validationWarnings).toEqual([]);
    expect(newState.fieldErrors.size).toBe(0);
  });
});

describe("Action type guards", () => {
  it("should identify data actions", () => {
    expect(isDataAction({ type: "UPDATE_DATA", payload: {} })).toBe(true);
    expect(isDataAction({ type: "SET_SUBMITTING", payload: true })).toBe(true);
    expect(isDataAction({ type: "RESET" })).toBe(true);
    expect(isDataAction({ type: "NEXT_STEP" })).toBe(false);
  });

  it("should identify step actions", () => {
    expect(isStepAction({ type: "NEXT_STEP" })).toBe(true);
    expect(isStepAction({ type: "PREV_STEP" })).toBe(true);
    expect(isStepAction({ type: "SET_STEP", payload: 3 })).toBe(true);
    expect(isStepAction({ type: "UPDATE_DATA", payload: {} })).toBe(false);
  });

  it("should identify validation actions", () => {
    expect(isValidationAction({ type: "SET_ERRORS", payload: [] })).toBe(true);
    expect(isValidationAction({ type: "CLEAR_VALIDATION" })).toBe(true);
    expect(isValidationAction({ type: "NEXT_STEP" })).toBe(false);
  });
});

describe("Complex workflows", () => {
  it("should handle complete wizard flow", () => {
    let state = createInitialState();

    // Step 1: 기본 정보 입력
    state = wizardReducer(state, {
      type: "UPDATE_DATA",
      payload: { name: "테스트 플랜", planPurpose: "내신대비" },
    });
    state = wizardReducer(state, { type: "NEXT_STEP" });

    expect(state.currentStep).toBe(2);
    expect(state.wizardData.name).toBe("테스트 플랜");
    expect(state.isDirty).toBe(true);

    // Step 2-5 건너뛰기
    state = wizardReducer(state, { type: "SET_STEP", payload: 6 });

    expect(state.currentStep).toBe(6);

    // Step 6: 검토 후 제출
    state = wizardReducer(state, { type: "SET_SUBMITTING", payload: true });

    expect(state.isSubmitting).toBe(true);

    // 성공
    state = wizardReducer(state, {
      type: "SET_CREATED_GROUP_ID",
      payload: "group-123",
    });
    state = wizardReducer(state, { type: "SET_SUBMITTING", payload: false });
    state = wizardReducer(state, { type: "NEXT_STEP" });

    expect(state.currentStep).toBe(7);
    expect(state.createdGroupId).toBe("group-123");
    expect(state.isSubmitting).toBe(false);
  });

  it("should handle validation error flow", () => {
    let state = createInitialState();

    // 유효성 검사 실패
    state = wizardReducer(state, {
      type: "SET_ERRORS",
      payload: ["기간을 설정해주세요"],
    });
    state = wizardReducer(state, {
      type: "SET_FIELD_ERROR",
      payload: { field: "periodStart", error: "시작일 필수" },
    });

    expect(state.validationErrors.length).toBe(1);
    expect(state.fieldErrors.get("periodStart")).toBe("시작일 필수");

    // 사용자가 수정
    state = wizardReducer(state, {
      type: "UPDATE_DATA",
      payload: { periodStart: "2026-01-01" },
    });
    state = wizardReducer(state, { type: "CLEAR_FIELD_ERROR", payload: "periodStart" });
    state = wizardReducer(state, { type: "SET_ERRORS", payload: [] });

    expect(state.validationErrors.length).toBe(0);
    expect(state.fieldErrors.size).toBe(0);
  });
});
