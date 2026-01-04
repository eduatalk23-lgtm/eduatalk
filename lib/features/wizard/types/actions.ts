/**
 * Wizard Action Types
 *
 * 위자드 상태 관리를 위한 액션 타입 정의
 * Data, Step, Validation 세 가지 카테고리로 분류됩니다.
 *
 * @module lib/features/wizard/types/actions
 */

import type { WizardStep } from "./base";
import type { BaseWizardData } from "./data";

// ============================================
// Data Actions
// ============================================

/**
 * 데이터 관련 액션
 */
export type DataAction<TData extends BaseWizardData = BaseWizardData> =
  | { type: "UPDATE_DATA"; payload: Partial<TData> }
  | { type: "UPDATE_DATA_FN"; payload: (prev: TData) => Partial<TData> }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "SET_CREATED_GROUP_ID"; payload: string | null }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET_DIRTY_STATE" }
  | { type: "RESET" };

/**
 * 데이터 액션 타입 목록
 */
export const DATA_ACTION_TYPES = [
  "UPDATE_DATA",
  "UPDATE_DATA_FN",
  "SET_DRAFT_ID",
  "SET_CREATED_GROUP_ID",
  "SET_SUBMITTING",
  "SET_ERROR",
  "RESET_DIRTY_STATE",
  "RESET",
] as const;

// ============================================
// Step Actions
// ============================================

/**
 * 단계 네비게이션 액션
 */
export type StepAction =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_STEP"; payload: WizardStep };

/**
 * 단계 액션 타입 목록
 */
export const STEP_ACTION_TYPES = ["NEXT_STEP", "PREV_STEP", "SET_STEP"] as const;

// ============================================
// Validation Actions
// ============================================

/**
 * 검증 관련 액션
 */
export type ValidationAction =
  | { type: "SET_ERRORS"; payload: string[] }
  | { type: "SET_WARNINGS"; payload: string[] }
  | { type: "SET_FIELD_ERROR"; payload: { field: string; error: string } }
  | { type: "SET_FIELD_ERRORS"; payload: Map<string, string> }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "CLEAR_VALIDATION" };

/**
 * 검증 액션 타입 목록
 */
export const VALIDATION_ACTION_TYPES = [
  "SET_ERRORS",
  "SET_WARNINGS",
  "SET_FIELD_ERROR",
  "SET_FIELD_ERRORS",
  "CLEAR_FIELD_ERROR",
  "CLEAR_VALIDATION",
] as const;

// ============================================
// Combined Action Type
// ============================================

/**
 * 모든 위자드 액션의 통합 타입
 */
export type WizardAction<TData extends BaseWizardData = BaseWizardData> =
  | DataAction<TData>
  | StepAction
  | ValidationAction;

// ============================================
// Type Guards
// ============================================

/**
 * 데이터 액션 타입 가드
 */
export function isDataAction<TData extends BaseWizardData>(
  action: WizardAction<TData>
): action is DataAction<TData> {
  return DATA_ACTION_TYPES.includes(action.type as typeof DATA_ACTION_TYPES[number]);
}

/**
 * 단계 액션 타입 가드
 */
export function isStepAction<TData extends BaseWizardData>(
  action: WizardAction<TData>
): action is StepAction {
  return STEP_ACTION_TYPES.includes(action.type as typeof STEP_ACTION_TYPES[number]);
}

/**
 * 검증 액션 타입 가드
 */
export function isValidationAction<TData extends BaseWizardData>(
  action: WizardAction<TData>
): action is ValidationAction {
  return VALIDATION_ACTION_TYPES.includes(action.type as typeof VALIDATION_ACTION_TYPES[number]);
}
