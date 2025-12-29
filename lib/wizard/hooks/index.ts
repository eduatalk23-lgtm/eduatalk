/**
 * 위저드 훅 모듈
 *
 * 위저드 기능을 위한 React 훅 모음
 *
 * @module lib/wizard/hooks
 */

// Auto Save
export { useAutoSave } from "./useAutoSave";
export type {
  AutoSaveStatus,
  UseAutoSaveOptions,
  UseAutoSaveResult,
} from "./useAutoSave";

// Draft Restore
export { useDraftRestore } from "./useDraftRestore";
export type {
  DraftRestoreStatus,
  UseDraftRestoreOptions,
  UseDraftRestoreResult,
} from "./useDraftRestore";

// Async Validation
export { useAsyncValidation, useFieldAsyncValidation } from "./useAsyncValidation";
export type {
  UseAsyncValidationOptions,
  UseAsyncValidationResult,
  FieldValidationState,
  UseFieldAsyncValidationOptions,
  UseFieldAsyncValidationResult,
} from "./useAsyncValidation";

// Step Branching
export {
  useStepBranching,
  useConditionalStep,
  useStepDependency,
} from "./useStepBranching";
export type {
  UseStepBranchingOptions,
  UseStepBranchingResult,
  UseConditionalStepOptions,
  UseStepDependencyOptions,
} from "./useStepBranching";

// Wizard Analytics
export {
  useWizardAnalytics,
  useStepTiming,
  useValidationAnalytics,
} from "./useWizardAnalytics";
export type {
  UseWizardAnalyticsOptions,
  UseWizardAnalyticsResult,
  UseStepTimingOptions,
  UseValidationAnalyticsOptions,
} from "./useWizardAnalytics";
