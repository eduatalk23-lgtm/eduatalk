/**
 * BatchAIPlanModal Context Re-exports
 *
 * admin-wizard/_context에서 Batch Context를 re-export합니다.
 * 짧은 import 경로를 제공하기 위한 wrapper 모듈입니다.
 *
 * @module BatchAIPlanModalWrapper
 */

export {
  BatchWizardProvider,
  useBatchData,
  useBatchStep,
  useBatchState,
  useBatchValidation,
  useBatchDispatch,
  useBatchWizard,
} from "../[id]/plans/_components/admin-wizard/_context";

export type {
  BatchModalStep,
  CostEstimate,
  StudentContentInfo,
  BatchWizardData,
  BatchWizardState,
  BatchDataAction,
  BatchStepAction,
  BatchStateAction,
  BatchValidationAction,
  BatchWizardAction,
  BatchDataContextValue,
  BatchStepContextValue,
  BatchStateContextValue,
  BatchValidationContextValue,
} from "../[id]/plans/_components/admin-wizard/_context";

export {
  createDefaultSettings,
  createDefaultBatchData,
  createInitialBatchState,
  isBatchDataAction,
  isBatchStepAction,
  isBatchStateAction,
  isBatchValidationAction,
} from "../[id]/plans/_components/admin-wizard/_context";

export {
  batchReducer,
  hasBatchDataChanged,
  hasRetryableStudents,
  getSuccessCount,
  getFailureCount,
} from "../[id]/plans/_components/admin-wizard/_context";
