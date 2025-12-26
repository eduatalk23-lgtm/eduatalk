/**
 * 리듀서 인덱스 파일
 *
 * Phase 3 코드 구조 개선: 리듀서 분리
 * 모든 리듀서와 관련 타입을 내보냅니다.
 */

export {
  dataReducer,
  isDataAction,
  type DataState,
  type DataAction,
} from "./dataReducer";

export {
  stepReducer,
  isStepAction,
  type StepState,
  type StepAction,
} from "./stepReducer";

export {
  validationReducer,
  isValidationAction,
  initialValidationState,
  type ValidationState,
  type ValidationAction,
} from "./validationReducer";

/**
 * 통합 액션 타입
 * 모든 리듀서의 액션을 합친 타입
 */
export type WizardAction =
  | import("./dataReducer").DataAction
  | import("./stepReducer").StepAction
  | import("./validationReducer").ValidationAction;
