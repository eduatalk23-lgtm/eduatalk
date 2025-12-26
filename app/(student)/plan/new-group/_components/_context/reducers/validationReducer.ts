/**
 * validationReducer - 검증 상태 리듀서
 *
 * Phase 3 코드 구조 개선: 리듀서 분리
 * 위저드 검증 관련 액션만 처리합니다.
 */

/**
 * 검증 상태 타입
 */
export type ValidationState = {
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;
};

/**
 * 검증 액션 타입
 */
export type ValidationAction =
  | { type: "SET_ERRORS"; payload: string[] }
  | { type: "SET_WARNINGS"; payload: string[] }
  | { type: "SET_FIELD_ERROR"; payload: { field: string; error: string } }
  | { type: "SET_FIELD_ERRORS"; payload: Map<string, string> }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "CLEAR_VALIDATION" };

/**
 * 검증 리듀서
 *
 * @param state 현재 검증 상태
 * @param action 검증 액션
 * @returns 새로운 검증 상태
 */
export function validationReducer(
  state: ValidationState,
  action: ValidationAction
): ValidationState {
  switch (action.type) {
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
    case "CLEAR_FIELD_ERROR": {
      const clearedFieldErrors = new Map(state.fieldErrors);
      clearedFieldErrors.delete(action.payload);
      return {
        ...state,
        fieldErrors: clearedFieldErrors,
      };
    }
    case "CLEAR_VALIDATION":
      return {
        ...state,
        validationErrors: [],
        validationWarnings: [],
        fieldErrors: new Map(),
      };
    default:
      return state;
  }
}

/**
 * 검증 액션 타입 체크 헬퍼
 */
export function isValidationAction(action: { type: string }): action is ValidationAction {
  return [
    "SET_ERRORS",
    "SET_WARNINGS",
    "SET_FIELD_ERROR",
    "SET_FIELD_ERRORS",
    "CLEAR_FIELD_ERROR",
    "CLEAR_VALIDATION",
  ].includes(action.type);
}

/**
 * 초기 검증 상태
 */
export const initialValidationState: ValidationState = {
  validationErrors: [],
  validationWarnings: [],
  fieldErrors: new Map(),
};
