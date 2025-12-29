/**
 * 위저드 서비스 모듈
 *
 * 위저드 기능을 위한 서비스 모음
 *
 * @module lib/wizard/services
 */

// Draft Storage
export {
  DraftStorageService,
  draftStorage,
} from "./draftStorage";
export type {
  DraftMetadata,
  StoredDraft,
  DraftStorageOptions,
} from "./draftStorage";

// Async Validation
export {
  AsyncValidationService,
  asyncValidation,
  createApiValidator,
  createUniquenessValidator,
  createConditionalAsyncValidator,
} from "./asyncValidation";
export type {
  AsyncValidationStatus,
  AsyncValidationResult,
  AsyncValidator,
  AsyncValidationConfig,
} from "./asyncValidation";

// Step Branching
export {
  StepBranchingService,
  createModeBasedRules,
  createOptionalStepRule,
  createDependencyRule,
} from "./stepBranching";
export type {
  BranchConditionResult,
  StepBranchRule,
  BranchPath,
  StepVisibility,
  StepBranchingConfig,
  StepFlowState,
} from "./stepBranching";

// Wizard Analytics
export {
  WizardAnalyticsService,
  wizardAnalytics,
} from "./analytics";
export type {
  AnalyticsEventType,
  AnalyticsEvent,
  StepTiming,
  ValidationErrorInfo,
  NavigationFlow,
  SessionSummary,
  AnalyticsConfig,
} from "./analytics";
