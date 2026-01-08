"use client";

/**
 * 플랜 생성 통합 섹션 Context Provider
 * 2-Layer Context 패턴: Selection + Flow
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type {
  SelectionContextValue,
  FlowContextValue,
  CreationMethod,
  PlanCreationStep,
  CreationResult,
} from "./types";
import { planCreationReducer, createInitialState } from "./reducer";

// Context 생성
const SelectionContext = createContext<SelectionContextValue | null>(null);
const FlowContext = createContext<FlowContextValue | null>(null);

// Custom Hooks
export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within PlanCreationProvider");
  }
  return context;
}

export function useFlow(): FlowContextValue {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error("useFlow must be used within PlanCreationProvider");
  }
  return context;
}

// 통합 Hook
export function usePlanCreation() {
  const selection = useSelection();
  const flow = useFlow();
  return { ...selection, ...flow };
}

// Provider Props
interface PlanCreationProviderProps {
  children: ReactNode;
  students: StudentListRow[];
  initialSelectedIds?: string[];
}

// Provider Component
export function PlanCreationProvider({
  children,
  students,
  initialSelectedIds,
}: PlanCreationProviderProps) {
  const [state, dispatch] = useReducer(
    planCreationReducer,
    initialSelectedIds,
    createInitialState
  );

  // Selection Context Value
  const toggleStudent = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_STUDENT", payload: id });
  }, []);

  const selectAllStudents = useCallback(() => {
    dispatch({
      type: "SELECT_ALL_STUDENTS",
      payload: students.map((s) => s.id),
    });
  }, [students]);

  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" });
  }, []);

  const selectMethod = useCallback((method: CreationMethod) => {
    dispatch({ type: "SELECT_METHOD", payload: method });
  }, []);

  const clearMethod = useCallback(() => {
    dispatch({ type: "CLEAR_METHOD" });
  }, []);

  const selectPlanner = useCallback((plannerId: string) => {
    dispatch({ type: "SELECT_PLANNER", payload: plannerId });
  }, []);

  const clearPlanner = useCallback(() => {
    dispatch({ type: "CLEAR_PLANNER" });
  }, []);

  const selectedStudents = useMemo(() => {
    return students.filter((s) => state.selectedStudentIds.has(s.id));
  }, [students, state.selectedStudentIds]);

  const selectionValue = useMemo<SelectionContextValue>(
    () => ({
      selectedStudentIds: state.selectedStudentIds,
      selectedStudents,
      selectedPlannerId: state.selectedPlannerId,
      selectedMethod: state.selectedMethod,
      toggleStudent,
      selectAllStudents,
      clearSelection,
      selectPlanner,
      clearPlanner,
      selectMethod,
      clearMethod,
    }),
    [
      state.selectedStudentIds,
      state.selectedPlannerId,
      state.selectedMethod,
      selectedStudents,
      toggleStudent,
      selectAllStudents,
      clearSelection,
      selectPlanner,
      clearPlanner,
      selectMethod,
      clearMethod,
    ]
  );

  // Flow Context Value
  const startCreation = useCallback(() => {
    dispatch({ type: "START_CREATION" });
  }, []);

  const finishCreation = useCallback((results: CreationResult[]) => {
    dispatch({ type: "FINISH_CREATION", payload: results });
  }, []);

  const updateResults = useCallback((results: CreationResult[]) => {
    dispatch({ type: "UPDATE_RESULTS", payload: results });
  }, []);

  const setStep = useCallback((step: PlanCreationStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const startRetry = useCallback((studentIds: string[]) => {
    dispatch({ type: "START_RETRY", payload: studentIds });
  }, []);

  // 실패한 학생 ID 목록 계산
  const failedStudentIds = useMemo(() => {
    return state.creationResults
      .filter((r) => r.status === "error")
      .map((r) => r.studentId);
  }, [state.creationResults]);

  const retryAllFailed = useCallback(() => {
    if (failedStudentIds.length > 0) {
      dispatch({ type: "START_RETRY", payload: failedStudentIds });
    }
  }, [failedStudentIds]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const resetResultsOnly = useCallback(() => {
    dispatch({ type: "RESET_RESULTS_ONLY" });
  }, []);

  const flowValue = useMemo<FlowContextValue>(
    () => ({
      currentStep: state.currentStep,
      isCreating: state.isCreating,
      results: state.creationResults,
      retryStudentIds: state.retryStudentIds,
      failedStudentIds,
      error: state.error,
      startCreation,
      finishCreation,
      updateResults,
      setStep,
      setError,
      startRetry,
      retryAllFailed,
      reset,
      resetResultsOnly,
    }),
    [
      state.currentStep,
      state.isCreating,
      state.creationResults,
      state.retryStudentIds,
      failedStudentIds,
      state.error,
      startCreation,
      finishCreation,
      updateResults,
      setStep,
      setError,
      startRetry,
      retryAllFailed,
      reset,
      resetResultsOnly,
    ]
  );

  return (
    <SelectionContext.Provider value={selectionValue}>
      <FlowContext.Provider value={flowValue}>{children}</FlowContext.Provider>
    </SelectionContext.Provider>
  );
}
